// Resend webhook handler — HID-001
// Receives bounce and complaint events from Resend and records them to the
// email_suppression_log audit table. Resend also maintains its own suppression
// list and will not re-deliver to suppressed addresses.
//
// Webhook verification: Resend signs payloads with a secret (RESEND_WEBHOOK_SECRET).
// Register the webhook in Resend dashboard → Webhooks → add endpoint:
//   https://<your-domain>/api/webhooks/email
//   Events: email.bounced, email.complained
//
// Middleware: this route requires raw body (Buffer) for HMAC verification.
// Register it BEFORE express.json() middleware in the main app.

import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";
import { getSupabase } from "../lib/supabase.js";

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
    // If no secret configured, skip verification (dev only).
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

  const { type, data } = event;

  if (type === "email.bounced" || type === "email.complained") {
    const reason = type === "email.bounced" ? "bounce" : "complaint";
    const supabase = getSupabase();

    for (const email of data.to) {
      const { error } = await supabase.from("email_suppression_log").insert({
        email,
        reason,
        source: `resend_${reason}`,
        metadata: { email_id: data.email_id, resend_event: type },
      });

      if (error) {
        req.log?.error(
          { err: error.message, email, reason },
          "[email-webhook] failed to write suppression_log"
        );
      }
    }
  }

  // Always return 200 — Resend retries on non-2xx.
  res.status(200).json({ received: true });
});

export default router;
