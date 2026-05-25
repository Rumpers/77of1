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

export default router;
