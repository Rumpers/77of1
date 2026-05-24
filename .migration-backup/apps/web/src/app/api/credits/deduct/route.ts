import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars not set");
  return createClient(url, key);
}

type DeductRpcResult = {
  success: boolean;
  error?: string;
  remainingBalance?: number;
};

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { creatorId, fanId, interactionId, cost } = body as {
    creatorId?: string;
    fanId?: string;
    interactionId?: string;
    cost?: unknown;
  };

  if (!creatorId || !fanId || !interactionId || cost == null) {
    return NextResponse.json(
      { error: "Missing required fields: creatorId, fanId, interactionId, cost" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(cost) || (cost as number) <= 0) {
    return NextResponse.json(
      { error: "cost must be a positive integer" },
      { status: 400 }
    );
  }

  const supabase = getSupabase();

  const { data, error } = await supabase.rpc("deduct_credits", {
    p_fan_id: fanId,
    p_creator_id: creatorId,
    p_interaction_id: interactionId,
    p_cost: cost as number,
  });

  if (error) {
    console.error("[credits/deduct] rpc error:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  const result = data as DeductRpcResult;

  if (!result.success) {
    switch (result.error) {
      case "insufficient_credits":
        return NextResponse.json(
          { error: "Insufficient credits", remainingBalance: result.remainingBalance ?? 0 },
          { status: 402 }
        );
      case "fan_not_found":
        return NextResponse.json({ error: "Fan account not found" }, { status: 404 });
      case "duplicate_transaction":
        return NextResponse.json({ error: "Duplicate interaction ID" }, { status: 409 });
      default:
        return NextResponse.json(
          { error: result.error ?? "Unknown error" },
          { status: 422 }
        );
    }
  }

  return NextResponse.json({
    success: true,
    remainingBalance: result.remainingBalance,
  });
}
