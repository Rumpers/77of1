// Resend webhook handler — HID-001
// PHASE-1 STUB: email_suppression_log table not in @workspace/db Phase 1 schema.
// Restored in Phase 2 when email suppression tables are migrated to Drizzle.
//
// POST /api/webhooks/email — receive Resend bounce/complaint events

import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";

const router: IRouter = Router();

// Resend event shapes (minimal surface)
interface ResendEmailEvent {
  type:
    | "email.bounced"
    | "email.complained"
    | "email.delivered"
    | "email.opened"
    | "email.clicked";
  data: {
    email_id: string;
    from: string;
    to: string[];
    created_at: string;
  };
}

function verifyResendSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined
): boolean {
  const secret = process.env["RESEND_WEBHOOK_SECRET"];
  if (!secret) {
    return process.env["NODE_ENV"] !== "production";
  }
  if (!signatureHeader) return false;

  const hmac = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(hmac, "hex"),
    Buffer.from(signatureHeader.replace("sha256=", ""), "hex")
  );
}

// POST /api/webhooks/email
// Must be mounted before express.json() — raw body required.
// Signature verification preserved; DB write stubbed until Phase 2.
router.post("/webhooks/email", async (req: Request, res: Response) => {
  const rawBody = req.body as Buffer;
  const sig = req.headers["resend-signature"] as string | undefined;

  if (!verifyResendSignature(rawBody, sig)) {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  let event: ResendEmailEvent;
  try {
    event = JSON.parse(rawBody.toString("utf8")) as ResendEmailEvent;
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const { type } = event;

  if (type === "email.bounced" || type === "email.complained") {
    // PHASE-1 STUB: email_suppression_log not in Phase 1 schema — restored in Phase 2
    req.log?.warn?.(
      { eventType: type },
      "[email-webhook] PHASE-1 STUB — suppression log write skipped (email_suppression_log not in Phase 1 schema)",
    );
  }

  // Always return 200 — Resend retries on non-2xx.
  res.status(200).json({ received: true });
});

export default router;
