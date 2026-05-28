import { Router, type IRouter, type Request, type Response } from "express";

const router: IRouter = Router();

// Reads version from package.json at startup so we don't import a file at request time
const version = process.env["npm_package_version"] ?? "unknown";

function requireHealthSecret(req: Request, res: Response): boolean {
  const secret = process.env["HEALTH_SECRET"];
  if (!secret) return true; // no secret configured → open (dev mode)
  if (req.headers["x-health-secret"] === secret) return true;
  res.status(401).json({ status: "error", error: "Unauthorized" });
  return false;
}

// GET /api/health — public load-balancer probe, always 200
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), version });
});

// Legacy alias kept for existing artifact.toml health check path
router.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), version });
});

// GET /api/health/db — Drizzle Pool ping; requires X-Health-Secret
// INFRA-01: replaces the old Supabase dynamic-import ping (T-02-06: health secret preserved)
// pool is imported lazily to avoid throwing at module load time when DATABASE_URL is absent.
router.get("/health/db", async (req: Request, res: Response) => {
  if (!requireHealthSecret(req, res)) return;

  const start = Date.now();
  try {
    const { pool } = await import("@workspace/db");
    await pool.query("SELECT 1");
    const latencyMs = Date.now() - start;
    res.json({ status: "ok", latencyMs });
  } catch (err) {
    const latencyMs = Date.now() - start;
    res.status(503).json({
      status: "error",
      latencyMs,
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
});

// GET /api/health/queue — Redis/BullMQ ping; requires X-Health-Secret
router.get("/health/queue", async (req: Request, res: Response) => {
  if (!requireHealthSecret(req, res)) return;

  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) {
    res.status(503).json({ status: "error", error: "REDIS_URL not configured" });
    return;
  }

  const start = Date.now();
  try {
    // @ts-ignore - ioredis/bullmq may not be installed in all environments
    const ioredisMod = await import("ioredis").catch(() => null);
    if (!ioredisMod) {
      res.status(503).json({ status: "error", error: "Redis adapter not available" });
      return;
    }
    // @ts-ignore
    const Redis = ioredisMod.default ?? ioredisMod.Redis;
    const redis = new Redis(redisUrl, { lazyConnect: true, connectTimeout: 3000, commandTimeout: 3000 });
    await redis.ping();
    const latencyMs = Date.now() - start;
    await redis.quit();
    res.json({ status: "ok", latencyMs });
  } catch (err) {
    const latencyMs = Date.now() - start;
    res.status(503).json({
      status: "error",
      latencyMs,
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
});

// GET /api/health/providers — GMI API ping; requires X-Health-Secret
router.get("/health/providers", async (req: Request, res: Response) => {
  if (!requireHealthSecret(req, res)) return;

  const apiKey = process.env["GMI_API_KEY"];
  const baseUrl = process.env["GMI_API_BASE_URL"];
  if (!apiKey || !baseUrl) {
    res.status(503).json({ text: "error", error: "GMI_API_KEY or GMI_API_BASE_URL not configured" });
    return;
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    if (!resp.ok) {
      res.status(503).json({
        text: "error",
        latencyMs,
        error: `GMI API returned HTTP ${resp.status}`,
      });
      return;
    }
    res.json({ text: "ok", latencyMs });
  } catch (err) {
    const latencyMs = Date.now() - start;
    res.status(503).json({
      text: "error",
      latencyMs,
      error: err instanceof Error ? err.message : "unknown error",
    });
  }
});

export default router;
