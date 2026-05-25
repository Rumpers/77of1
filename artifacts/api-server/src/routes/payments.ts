import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";
import { Queue } from "bullmq";
import { getSupabase } from "../lib/supabase.js";
import { CreateCheckoutBody } from "@workspace/api-zod";
import { QUEUE_NAMES } from "@workspace/queue";
import type { DunningRetryPayload } from "@workspace/queue";

const router: IRouter = Router();

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // @ts-ignore - Stripe apiVersion
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

// POST /api/payments/checkout
router.post("/payments/checkout", async (req: Request, res: Response) => {
  const parsed = CreateCheckoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing required fields: creatorId, fanId, packId" });
    return;
  }

  const { creatorId, fanId, packId } = parsed.data;
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const { data: pack, error } = await supabase
    .from("credit_packs")
    .select("*")
    .eq("id", packId)
    .eq("active", true)
    .single();

  if (error || !pack) {
    res.status(404).json({ error: "Credit pack not found" });
    return;
  }

  if (pack.stripe_price_id.startsWith("STRIPE_PRICE_")) {
    res.status(503).json({ error: "Credit pack Stripe Price ID not configured" });
    return;
  }

  const stripe = getStripe();
  const appUrl = process.env.APP_URL ?? "https://7of1.app";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: pack.stripe_price_id, quantity: 1 }],
      metadata: { fanId, creatorId, packId },
      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment/cancel`,
    });
    res.json({ checkoutUrl: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    req.log.error({ err: message }, "[checkout] stripe session creation failed");
    res.status(502).json({ error: "Failed to create checkout session" });
  }
});

// POST /api/webhooks/stripe
// Note: raw body needed for Stripe signature verification — must use express.raw() middleware
router.post("/webhooks/stripe", async (req: Request, res: Response) => {
  const rawBody = req.body as Buffer;
  const signature = req.headers["stripe-signature"] as string | undefined;

  if (!signature) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    req.log.error("[webhook] STRIPE_WEBHOOK_SECRET not set");
    res.status(500).json({ error: "Webhook not configured" });
    return;
  }

  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody.toString(), signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    req.log.error({ err: message }, "[webhook] signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      res.json({ received: true });
      return;
    }

    const { fanId, creatorId, packId } = (session.metadata ?? {}) as Record<string, string>;
    if (!fanId || !creatorId || !packId) {
      req.log.error({ sessionId: session.id }, "[webhook] missing session metadata");
      res.status(422).json({ error: "Missing session metadata" });
      return;
    }

    const supabase = getSupabase();
    const { data: pack, error: packError } = await supabase
      .from("credit_packs")
      .select("credits")
      .eq("id", packId)
      .single();

    if (packError || !pack) {
      req.log.error({ packId }, "[webhook] credit pack not found");
      res.status(422).json({ error: "Pack not found" });
      return;
    }

    const { data: result, error: rpcError } = await supabase.rpc("apply_credit_purchase", {
      p_stripe_event_id: event.id,
      p_fan_id: fanId,
      p_creator_id: creatorId,
      p_credits: pack.credits,
    });

    if (rpcError) {
      req.log.error({ err: rpcError.message }, "[webhook] apply_credit_purchase failed");
      res.status(500).json({ error: "Failed to apply credits" });
      return;
    }

    if (result === "duplicate") {
      req.log.info({ eventId: event.id }, "[webhook] duplicate event ignored");
    } else {
      req.log.info({ fanId, creatorId, packId, credits: pack.credits }, "[webhook] credits applied");
    }
  }

  if (event.type === "invoice.payment_failed") {
    await handleInvoicePaymentFailed(req, event);
  }

  if (event.type === "invoice.payment_succeeded") {
    await handleInvoicePaymentSucceeded(req, event);
  }

  if (event.type === "customer.subscription.deleted") {
    await handleSubscriptionDeleted(req, event);
  }

  res.json({ received: true });
});

// Handles invoice.payment_failed Stripe events.
// Idempotent: looks up fan_subscriptions by stripe_subscription_id; if already
// in dunning, no-ops (the ladder worker manages further transitions).
async function handleInvoicePaymentFailed(
  req: Request,
  event: Stripe.Event,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const stripeSubId = (invoice as Stripe.Invoice & { subscription?: string }).subscription;

  if (!stripeSubId) {
    req.log.warn({ eventId: event.id }, "[webhook/dunning] invoice has no subscription id");
    return;
  }

  const supabase = getSupabase();

  // Find the subscription record
  const { data: sub } = await supabase
    .from("fan_subscriptions")
    .select("id, fan_id, creator_id, stripe_subscription_id, stripe_customer_id, dunning_state")
    .eq("stripe_subscription_id", stripeSubId)
    .maybeSingle();

  if (!sub) {
    req.log.warn({ stripeSubId }, "[webhook/dunning] no subscription record found");
    return;
  }

  // Already in dunning — the ladder worker manages transitions
  if (sub.dunning_state !== "active" && sub.dunning_state !== "recovered") {
    req.log.info({ subId: sub.id, dunningState: sub.dunning_state }, "[webhook/dunning] already in dunning — skipping");
    return;
  }

  // Check dunning_enabled flag
  const { data: flag } = await supabase
    .from("feature_flags")
    .select("enabled")
    .eq("key", "dunning_enabled")
    .maybeSingle();

  if (!flag?.enabled) {
    req.log.info({ subId: sub.id }, "[webhook/dunning] flag disabled — skipping ladder");
    return;
  }

  // Kick off the dunning ladder with attempt=0
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    req.log.error("[webhook/dunning] REDIS_URL not set — cannot enqueue dunning job");
    return;
  }

  const jobId = `dunning:${sub.id}:attempt:0:event:${event.id}`;
  const payload: DunningRetryPayload = {
    type: "dunning-retry",
    subscriptionId: sub.id,
    fanId: sub.fan_id,
    creatorId: sub.creator_id,
    stripeSubscriptionId: sub.stripe_subscription_id,
    stripeCustomerId: sub.stripe_customer_id,
    attempt: 0,
  };

  try {
    const queue = new Queue(QUEUE_NAMES.dunningRetry, { connection: { url: redisUrl } });
    await queue.add("dunning-retry", payload, { jobId, delay: 0 });
    await queue.close();
    req.log.info({ subId: sub.id, jobId }, "[webhook/dunning] dunning ladder enqueued");
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    req.log.error({ err: message }, "[webhook/dunning] enqueue failed");
  }
}

// invoice.payment_succeeded — Stripe Smart Retries recovered the payment.
// Reset dunning state to recovered + write audit entry.
async function handleInvoicePaymentSucceeded(
  req: Request,
  event: Stripe.Event,
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const stripeSubId = (invoice as Stripe.Invoice & { subscription?: string }).subscription;

  if (!stripeSubId) return;

  const supabase = getSupabase();

  const { data: sub } = await supabase
    .from("fan_subscriptions")
    .select("id, fan_id, creator_id, dunning_state, dunning_attempt")
    .eq("stripe_subscription_id", stripeSubId)
    .maybeSingle();

  if (!sub) return;

  // Only act when we were in a dunning cycle (not a normal first payment)
  if (
    sub.dunning_state === "active" ||
    sub.dunning_state === "recovered" ||
    sub.dunning_state === "cancelled"
  ) {
    return;
  }

  const fromState = sub.dunning_state;

  const { error } = await supabase
    .from("fan_subscriptions")
    .update({
      dunning_state: "recovered",
      dunning_retry_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  if (error) {
    req.log.error({ err: error.message, subId: sub.id }, "[webhook/dunning] recovery update failed");
    return;
  }

  await supabase.from("dunning_audit_log").insert({
    subscription_id: sub.id,
    fan_id: sub.fan_id,
    creator_id: sub.creator_id,
    from_state: fromState,
    to_state: "recovered",
    event_type: "dunning_recovered",
    attempt: sub.dunning_attempt,
    payload: { stripe_event_id: event.id, source: "stripe_webhook" },
  });

  await supabase.from("audit_log").insert({
    creator_id: sub.creator_id,
    fan_id: sub.fan_id,
    event_type: "subscription.dunning_recovered",
    payload: {
      subscription_id: sub.id,
      from_state: fromState,
      to_state: "recovered",
      stripe_event_id: event.id,
    },
  });

  req.log.info({ subId: sub.id, fromState }, "[webhook/dunning] recovered via Stripe Smart Retries");
}

// customer.subscription.deleted — fan cancelled or Stripe auto-cancelled.
// Cancellation is honoured < 1 request cycle (acceptance criterion).
async function handleSubscriptionDeleted(
  req: Request,
  event: Stripe.Event,
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;
  const stripeSubId = subscription.id;

  const supabase = getSupabase();

  const { data: sub } = await supabase
    .from("fan_subscriptions")
    .select("id, fan_id, creator_id, dunning_state, dunning_attempt")
    .eq("stripe_subscription_id", stripeSubId)
    .maybeSingle();

  if (!sub) {
    req.log.warn({ stripeSubId }, "[webhook/dunning] subscription.deleted: no record found");
    return;
  }

  if (sub.dunning_state === "cancelled") {
    req.log.info({ subId: sub.id }, "[webhook/dunning] already cancelled — skipping");
    return;
  }

  const fromState = sub.dunning_state;

  // Hard-cancel the subscription row + mark any active subscription status cancelled
  const { error } = await supabase
    .from("fan_subscriptions")
    .update({
      dunning_state: "cancelled",
      status: "cancelled",
      dunning_retry_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sub.id);

  if (error) {
    req.log.error({ err: error.message, subId: sub.id }, "[webhook/dunning] cancel update failed");
    return;
  }

  await supabase.from("dunning_audit_log").insert({
    subscription_id: sub.id,
    fan_id: sub.fan_id,
    creator_id: sub.creator_id,
    from_state: fromState,
    to_state: "cancelled",
    event_type: "dunning_cancelled",
    attempt: sub.dunning_attempt,
    payload: { stripe_event_id: event.id, source: "stripe_webhook" },
  });

  await supabase.from("audit_log").insert({
    creator_id: sub.creator_id,
    fan_id: sub.fan_id,
    event_type: "subscription.cancelled",
    payload: {
      subscription_id: sub.id,
      from_state: fromState,
      stripe_event_id: event.id,
    },
  });

  req.log.info({ subId: sub.id, fromState }, "[webhook/dunning] subscription cancelled immediately");
}

// GET /api/admin/dunning-metrics — recovery rate by creator + time window.
// Query params: creator_id (optional), window (30d | 7d | 90d, default 30d).
router.get("/admin/dunning-metrics", async (req: Request, res: Response) => {
  let supabase: ReturnType<typeof getSupabase>;
  try {
    supabase = getSupabase();
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const creatorId = req.query["creator_id"] as string | undefined;
  const windowStr = (req.query["window"] as string | undefined) ?? "30d";
  const windowDays = windowStr === "7d" ? 7 : windowStr === "90d" ? 90 : 30;
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // Pull entries from dunning_audit_log for the window
  let query = supabase
    .from("dunning_audit_log")
    .select("subscription_id, creator_id, to_state, created_at")
    .gte("created_at", since);

  if (creatorId) {
    query = query.eq("creator_id", creatorId);
  }

  const { data: entries, error } = await query;

  if (error) {
    req.log.error({ err: error.message }, "[admin/dunning-metrics] query failed");
    res.status(500).json({ error: "Failed to fetch metrics" });
    return;
  }

  // Aggregate: unique subscriptions by their terminal state (last-wins per sub)
  const latest = new Map<string, string>();
  for (const row of entries ?? []) {
    latest.set(row.subscription_id, row.to_state);
  }

  let churned = 0;
  let recovered = 0;
  let cancelled = 0;
  let inDunning = 0;

  for (const state of latest.values()) {
    if (state === "grace" || state === "paused") {
      inDunning++;
      churned++;
    } else if (state === "recovered") {
      recovered++;
      churned++;
    } else if (state === "cancelled") {
      cancelled++;
      churned++;
    }
  }

  const recoveryPct = churned > 0 ? Math.round((recovered / churned) * 100) : 0;

  res.json({
    window: windowStr,
    creatorId: creatorId ?? null,
    churned,
    recovered,
    cancelled,
    inDunning,
    recoveryPct,
    since,
  });
});

export default router;
