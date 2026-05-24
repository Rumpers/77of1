// Moderation audit log writer — writes every moderation call to Replit DB.
// Audit failure is non-blocking: logs the error but does not throw.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModerationResult } from "@7of1/types";
import { createHash } from "crypto";

export interface ModerationAuditEntry {
  jobId: string;
  creatorId: string;
  fanId: string;
  language: "en" | "ja" | "zh-TW";
  provider: "gmi" | "azure";
  result: ModerationResult;
  latencyMs: number;
  text: string;
}

// SHA-256 of text is stored, not the raw text, to limit PII exposure in the audit table.
export async function writeModerationAudit(
  supabase: SupabaseClient,
  entry: ModerationAuditEntry
): Promise<void> {
  const textSha256 = createHash("sha256")
    .update(entry.text, "utf8")
    .digest("hex");

  const { error } = await supabase.from("moderation_audit_log").insert({
    job_id: entry.jobId,
    creator_id: entry.creatorId,
    fan_id: entry.fanId,
    language: entry.language,
    provider: entry.provider,
    passed: entry.result.passed,
    flagged_categories: entry.result.flaggedCategories,
    confidence: entry.result.confidence,
    latency_ms: entry.latencyMs,
    text_sha256: textSha256,
  });

  if (error) {
    // Audit failure is a monitoring concern, not a user-facing error.
    console.error(
      `[audit] moderation_audit_log write failed job=${entry.jobId}: ${error.message}`
    );
  }
}
