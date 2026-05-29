// Safety audit log writer + Slack alert webhook (OF-161 / OF-132 crisis intervention).
// All writes are async fire-and-forget — never slows down the response path.
// No raw text or fan PII stored; hashes only (COMPLY-03, D-02).
//
// Moved to twin-runtime in plan 02-06a as a Rule 3 (blocking) deviation:
// `moderation.ts` consumes `writeSafetyAuditLog` + `CrisisLevel`, so it must
// travel with it into the shared package.

import { createHash } from "crypto";
import { db } from "@workspace/db";
import { safetyAuditLogTable } from "@workspace/db";

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
  categoryScores?: Record<string, number>;
  responseSent: boolean;
  twinPaused: boolean;
  retentionCategory?: "operational" | "transcript" | "audit" | "ephemeral_30d";
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

export function writeSafetyAuditLog(entry: SafetyAuditEntry): void {
  // Intentionally fire-and-forget — caller must not await this.
  void (async () => {
    const fanIdHash = sha256(entry.fanId);
    const messageHash = sha256(entry.messageText);

    let alerted = false;
    if (entry.crisisLevel === "high") {
      await fireSlackAlert(entry);
      alerted = true;
    }

    try {
      await db.insert(safetyAuditLogTable).values({
        creatorId: entry.creatorId,
        fanIdHash,
        sessionId: entry.sessionId,
        messageHash,
        crisisLevel: entry.crisisLevel,
        crisisType: entry.crisisType ?? null,
        locale: entry.locale,
        confidence: entry.confidence ?? null,
        categoryScores: entry.categoryScores ?? null,
        responseSent: entry.responseSent,
        twinPaused: entry.twinPaused,
        alerted,
        retentionCategory: entry.retentionCategory ?? "audit",
      });
    } catch (err) {
      console.error(`[safety-audit] DB write failed session=${entry.sessionId}: ${(err as Error).message}`);
    }
  })();
}
