import crypto from "crypto";
import type { CreatorKyc } from "@workspace/db";

// ─── Status enum (collapsed from 9-state to 3-state per D-05) ────────────────
// 'signed'   — creator has signed the personality-rights agreement (incl. voice synthesis scope)
// 'pending'  — awaiting signature or under ops review
// 'rejected' — ops rejected; twin permanently blocked for this creator
export type KycStatus = "pending" | "signed" | "rejected";

// Re-export the Drizzle row type as KycRow for callers
export type KycRow = CreatorKyc;

// DB imports are lazy to avoid throwing at module load time when DATABASE_URL is absent.
async function getDb() {
  const { db, creatorKycTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  return { db, creatorKycTable, eq };
}

// ─── ensureKycRow ─────────────────────────────────────────────────────────────
// Creates a KYC row if one does not exist. Returns the row.
export async function ensureKycRow(creatorId: string): Promise<KycRow> {
  const { db, creatorKycTable } = await getDb();
  await db
    .insert(creatorKycTable)
    .values({ creatorId, status: "pending" })
    .onConflictDoNothing();

  const row = await getKycRow(creatorId);
  if (!row) throw new Error("creator_kyc row missing after ensure");
  return row;
}

// ─── getKycRow ────────────────────────────────────────────────────────────────
// Returns the full KYC row for a creator, or null if none exists.
export async function getKycRow(creatorId: string): Promise<KycRow | null> {
  const { db, creatorKycTable, eq } = await getDb();
  return db
    .select()
    .from(creatorKycTable)
    .where(eq(creatorKycTable.creatorId, creatorId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

// ─── isKycSigned ─────────────────────────────────────────────────────────────
// Twin production gate: returns true ONLY when status === 'signed'.
// Strict positive assertion per D-05: null / missing row / pending / rejected all return false.
export async function isKycSigned(creatorId: string): Promise<boolean> {
  const { db, creatorKycTable, eq } = await getDb();
  const row = await db
    .select({ status: creatorKycTable.status })
    .from(creatorKycTable)
    .where(eq(creatorKycTable.creatorId, creatorId))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  // ONLY 'signed' passes. null/pending/rejected all block (Pitfall #4 — KYC null bypass).
  return row?.status === "signed";
}

// ─── initiateSignwellSigning ──────────────────────────────────────────────────
// Creates a SignWell personality-rights signing request for a creator.
// Keeps the SignWell fetch logic intact; replaces the final Supabase .update() with Drizzle.
export async function initiateSignwellSigning(
  creatorId: string,
  creatorEmail: string,
  creatorDisplayName: string
): Promise<{ signingUrl: string; docId: string }> {
  const apiKey = process.env.SIGNWELL_API_KEY;
  const templateId = process.env.SIGNWELL_TEMPLATE_ID;
  if (!apiKey || !templateId) {
    throw new Error("SIGNWELL_API_KEY and SIGNWELL_TEMPLATE_ID must be set");
  }

  const body = {
    test_mode: process.env.NODE_ENV !== "production" ? "1" : "0",
    files: [{ template_id: templateId }],
    signers: [
      {
        id: "1",
        name: creatorDisplayName,
        email: creatorEmail,
      },
    ],
    fields: [
      { api_id: "creator_name", value: creatorDisplayName },
      { api_id: "creator_id", value: creatorId },
    ],
    redirect_url: `${process.env.APP_BASE_URL ?? ""}/onboard/kyc/signed`,
    webhook_url: `${process.env.APP_BASE_URL ?? ""}/api/kyc/signwell-webhook`,
  };

  const res = await fetch("https://www.signwell.com/api/v1/documents/", {
    method: "POST",
    headers: {
      "X-Api-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SignWell error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as {
    id: string;
    signing_links?: { signing_url: string }[];
  };

  const signingUrl = json.signing_links?.[0]?.signing_url;
  if (!signingUrl) throw new Error("SignWell returned no signing URL");

  // Update the KYC row via Drizzle — status stays 'pending' until webhook fires 'signed'
  const { db, creatorKycTable, eq } = await getDb();
  await db
    .update(creatorKycTable)
    .set({
      signwellDocId: json.id,
      signwellSigningUrl: signingUrl,
      status: "pending",
      updatedAt: new Date(),
    })
    .where(eq(creatorKycTable.creatorId, creatorId));

  return { signingUrl, docId: json.id };
}

// ─── hashIpForKyc / extractIp ─────────────────────────────────────────────────
// No Supabase dependency — preserved verbatim.
export function hashIpForKyc(ip: string): string {
  return crypto.createHash("sha256").update(ip.trim()).digest("hex");
}

export function extractIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  const realIp = headers["x-real-ip"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded ?? realIp ?? "::1";
  return (Array.isArray(raw) ? raw[0] : raw) ?? "::1";
}
