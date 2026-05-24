import { Router, type IRouter, type Request, type Response } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req: Request, res: Response) => {
  const data = HealthCheckResponse.parse({ status: "ok", service: "7of1-api" });
  res.json(data);
});

router.get("/health/queue", async (req: Request, res: Response) => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    res.status(503).json({ status: "error", error: "REDIS_URL not configured" });
    return;
  }

  try {
    // @ts-ignore - bullmq may not be installed in this environment
    const bullmqModule = await import("bullmq").catch(() => null);
    if (!bullmqModule) {
      res.status(503).json({ status: "error", error: "Queue adapter not available" });
      return;
    }
    // @ts-ignore
    const { Queue, QueueEvents } = bullmqModule;
    const queue = new Queue("generation-jobs", { connection: { url: redisUrl } });
    const counts = await queue.getJobCounts();
    const workers = await queue.getWorkers();
    const healthy = true;
    await queue.close();
    res.json({
      status: healthy ? "ok" : "degraded",
      queue: "generation-jobs",
      counts: {
        pending: (counts.waiting ?? 0) + (counts.delayed ?? 0),
        active: counts.active ?? 0,
        failed: counts.failed ?? 0,
        completed: counts.completed ?? 0,
      },
      workers: {
        count: workers.length,
        status: workers.length > 0 ? "active" : "inactive",
      },
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
});

export default router;
