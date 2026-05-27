// Subscriptions route — OF-168
// POST /api/subscriptions/:id/retry — fan-initiated immediate charge attempt.
// Enqueues a dunning-retry job with attempt=current+1 at zero delay.

import { Router, type IRouter, type Request, type Response } from "express";
import { getSupabase } from "../lib/supabase.js";
import { Queue } from "bullmq";
import { QUEUE_NAMES } from "@workspace/queue";
import type { DunningRetryPayload } from "@workspace/queue";
import { requireFanAccess } from "../middlewares/require-fan-access.js";

const router: IRouter = Router();

// POST /api/subscriptions/:id/retry
// Fan-initiated retry. Moves subscription back toward active by triggering an
// immediate charge attempt via the dunning worker.
router.post(
  "/subscriptions/:id/retry",
  requireFanAccess,
  async (req: Request, res: Response) => {
    const { id: subscriptionId } = req.params;
    const fanId = res.locals.fanId;

    if (!fanId) {
      res.status(401).json({ error: "Fan auth required" });
      return;
    }

    let supabase: ReturnType<typeof getSupabase>;
    try {
      supabase = getSupabase();
    } catch {
      res.status(503).json({ error: "Database not configured" });
      return;
    }

    // Fetch subscription — verify ownership by fan_id
    const { data: sub, error: fetchErr } = await supabase
      .from("fan_subscriptions")
      .select("id, fan_id, creator_id, stripe_subscription_id, stripe_customer_id, dunning_state, dunning_attempt")
      .eq("id", subscriptionId)
      .eq("fan_id", fanId)
      .maybeSingle();

    if (fetchErr || !sub) {
      res.status(404).json({ error: "Subscription not found" });
      return;
    }

    if (sub.dunning_state === "cancelled") {
      res.status(422).json({ error: "Subscription is cancelled — retry not available" });
      return;
    }

    if (sub.dunning_state === "active" || sub.dunning_state === "recovered") {
      res.status(422).json({ error: "Subscription is already active" });
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      res.status(503).json({ error: "Queue not configured" });
      return;
    }

    // Enqueue an immediate retry job (delay=0, attempt=current)
    // jobId deduplicates concurrent taps of the retry button
    const jobId = `dunning:${subscriptionId}:fan-retry:${Date.now()}`;
    const payload: DunningRetryPayload = {
      type: "dunning-retry",
      subscriptionId: sub.id,
      fanId: sub.fan_id,
      creatorId: sub.creator_id,
      stripeSubscriptionId: sub.stripe_subscription_id,
      stripeCustomerId: sub.stripe_customer_id,
      attempt: sub.dunning_attempt,
    };

    try {
      const queue = new Queue(QUEUE_NAMES.dunningRetry, { connection: { url: redisUrl } });
      await queue.add("dunning-retry", payload, { jobId, delay: 0 });
      await queue.close();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Queue error";
      req.log.error({ err: message }, "[subscriptions/retry] enqueue failed");
      res.status(502).json({ error: "Failed to enqueue retry" });
      return;
    }

    res.json({ queued: true, subscriptionId, attempt: sub.dunning_attempt });
  },
);

export default router;
