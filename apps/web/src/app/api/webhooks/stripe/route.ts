import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import type { DbCreditPack } from "@7of1/types";

export const runtime = "nodejs";

// App Router: consume raw body via req.text().
// Stripe signature verification requires the exact unmodified bytes.

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const stripe = getStripe();

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    console.error("[webhook] signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as {
      payment_status: string;
      id: string;
      metadata: Record<string, string> | null;
    };

    if (session.payment_status !== "paid") {
      // Async payment method (e.g. bank transfer) — wait for payment_intent.succeeded
      return NextResponse.json({ received: true });
    }

    const { fanId, creatorId, packId } = session.metadata ?? {};
    if (!fanId || !creatorId || !packId) {
      console.error("[webhook] missing session metadata", { sessionId: session.id });
      return NextResponse.json({ error: "Missing session metadata" }, { status: 422 });
    }

    const supabase = getSupabase();

    const { data: pack, error: packError } = await supabase
      .from("credit_packs")
      .select("credits")
      .eq("id", packId)
      .single<Pick<DbCreditPack, "credits">>();

    if (packError || !pack) {
      console.error("[webhook] credit pack not found:", packId);
      return NextResponse.json({ error: "Pack not found" }, { status: 422 });
    }

    const { data: result, error: rpcError } = await supabase.rpc("apply_credit_purchase", {
      p_stripe_event_id: event.id,
      p_fan_id: fanId,
      p_creator_id: creatorId,
      p_credits: pack.credits,
    });

    if (rpcError) {
      console.error("[webhook] apply_credit_purchase failed:", rpcError.message);
      return NextResponse.json({ error: "Failed to apply credits" }, { status: 500 });
    }

    if (result === "duplicate") {
      console.log("[webhook] duplicate event ignored:", event.id);
    } else {
      console.log("[webhook] credits applied:", { fanId, creatorId, packId, credits: pack.credits });
    }
  }

  return NextResponse.json({ received: true });
}
