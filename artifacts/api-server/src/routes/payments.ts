import { Router, type IRouter, type Request, type Response } from "express";
import Stripe from "stripe";
import { getSupabase } from "../lib/supabase.js";
import { CreateCheckoutBody } from "@workspace/api-zod";

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

  res.json({ received: true });
});

export default router;
