// Safety audit log writer + Slack alert webhook (OF-161 / OF-132 crisis intervention).
// All writes are async fire-and-forget — never slows down the response path.
// No raw text or fan PII stored; hashes only.

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CrisisLevel = "none" | "low" | "medium" | "high";

export interface SafetyAuditEntry {
  creatorId: string;
  fanId: string;
  sessionId: string;
  messageText: string;
  crisisLevel: CrisisLevel;
  crisisType?: string;
  locale: string;
  confidence?: number;
  responseSent: boolean;
  twinPaused: boolean;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function fireSlackAlert(entry: SafetyAuditEntry): Promise<void> {
  const webhookUrl = process.env.SAFETY_ALERT_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("[safety-audit] SAFETY_ALERT_WEBHOOK_URL not set — skipping Slack alert");
    return;
  }

  const payload = {
    text: ":rotating_light: *Safety alert — high crisis level*",
    blocks: [
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Timestamp:*\n${new Date().toISOString()}` },
          { type: "mrkdwn", text: `*Creator ID:*\n${entry.creatorId}` },
          { type: "mrkdwn", text: `*Session ID:*\n${entry.sessionId}` },
          { type: "mrkdwn", text: `*Crisis type:*\n${entry.crisisType ?? "unknown"}` },
          { type: "mrkdwn", text: `*Locale:*\n${entry.locale}` },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[safety-audit] Slack webhook returned ${res.status}`);
    }
  } catch (err) {
    console.error(`[safety-audit] Slack webhook POST failed: ${(err as Error).message}`);
  }
}

export function writeSafetyAuditLog(
  supabase: SupabaseClient,
  entry: SafetyAuditEntry,
): void {
  // Intentionally fire-and-forget — caller must not await this.
  void (async () => {
    const fanIdHash = sha256(entry.fanId);
    const messageHash = sha256(entry.messageText);

    let alerted = false;
    if (entry.crisisLevel === "high") {
      await fireSlackAlert(entry);
      alerted = true;
    }

    const { error } = await supabase.from("safety_audit_log").insert({
      creator_id: entry.creatorId,
      fan_id_hash: fanIdHash,
      session_id: entry.sessionId,
      message_hash: messageHash,
      crisis_level: entry.crisisLevel,
      crisis_type: entry.crisisType ?? null,
      locale: entry.locale,
      confidence: entry.confidence ?? null,
      response_sent: entry.responseSent,
      twin_paused: entry.twinPaused,
      alerted,
    });

    if (error) {
      console.error(`[safety-audit] DB write failed session=${entry.sessionId}: ${error.message}`);
    }
  })();
}
