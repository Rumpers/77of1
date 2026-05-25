import crypto from "crypto";
import { getSupabase } from "./supabase.js";

export type KycStatus =
  | "pending"
  | "id_submitted"
  | "id_verified"
  | "signing_initiated"
  | "rights_signed"
  | "tax_submitted"
  | "ops_approved"
  | "complete"
  | "rejected";

export type KycRow = {
  id: string;
  creator_id: string;
  status: KycStatus;
  id_doc_type: string | null;
  id_doc_region: string | null;
  id_doc_storage_path: string | null;
  id_doc_submitted_at: string | null;
  signwell_doc_id: string | null;
  signwell_signing_url: string | null;
  signwell_status: string | null;
  personality_rights_signed_at: string | null;
  personality_rights_ip_hash: string | null;
  tax_form_type: string | null;
  tax_form_storage_path: string | null;
  tax_form_submitted_at: string | null;
  ops_notes: string | null;
  ops_reviewed_by: string | null;
  ops_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getKycRow(creatorId: string): Promise<KycRow | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("creator_kyc")
    .select("*")
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (error) throw error;
  return data as KycRow | null;
}

export async function ensureKycRow(creatorId: string): Promise<KycRow> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("creator_kyc")
    .upsert({ creator_id: creatorId, status: "pending" }, { onConflict: "creator_id", ignoreDuplicates: true })
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (data) return data as KycRow;
  // Row already existed — re-fetch
  const existing = await getKycRow(creatorId);
  if (!existing) throw new Error("creator_kyc row missing after upsert");
  return existing;
}

/** Twin production gate: returns true only when the creator is fully KYC-cleared. */
export async function isKycComplete(creatorId: string): Promise<boolean> {
  const row = await getKycRow(creatorId);
  return row?.status === "complete";
}

/** Initiate a SignWell personality-rights signing request for a creator. */
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

  const sb = getSupabase();
  await sb
    .from("creator_kyc")
    .update({
      signwell_doc_id: json.id,
      signwell_signing_url: signingUrl,
      signwell_status: "pending",
      status: "signing_initiated",
    })
    .eq("creator_id", creatorId);

  return { signingUrl, docId: json.id };
}

export function hashIpForKyc(ip: string): string {
  return crypto.createHash("sha256").update(ip.trim()).digest("hex");
}

export function extractIp(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers["x-forwarded-for"];
  const realIp = headers["x-real-ip"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded ?? realIp ?? "::1";
  return (Array.isArray(raw) ? raw[0] : raw) ?? "::1";
}
