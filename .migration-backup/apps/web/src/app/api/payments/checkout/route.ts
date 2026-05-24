import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import type { DbCreditPack } from "@7of1/types";

export const runtime = "nodejs";

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
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creatorId, fanId, packId } = body as {
    creatorId?: string;
    fanId?: string;
    packId?: string;
  };
  if (!creatorId || !fanId || !packId) {
    return NextResponse.json(
      { error: "Missing required fields: creatorId, fanId, packId" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  const { data: pack, error } = await supabase
    .from("credit_packs")
    .select("*")
    .eq("id", packId)
    .eq("active", true)
    .single<DbCreditPack>();

  if (error || !pack) {
    return NextResponse.json({ error: "Credit pack not found" }, { status: 404 });
  }

  if (pack.stripe_price_id.startsWith("STRIPE_PRICE_")) {
    return NextResponse.json(
      { error: "Credit pack Stripe Price ID not configured" },
      { status: 503 }
    );
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
    return NextResponse.json({ checkoutUrl: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[checkout] stripe session creation failed:", message);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 502 });
  }
}
