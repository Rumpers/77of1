import { NextResponse } from "next/server";
import { createBullMQAdapter } from "@7of1/queue";

export const runtime = "nodejs";

export async function GET() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return NextResponse.json(
      { status: "error", error: "REDIS_URL not configured" },
      { status: 503 },
    );
  }

  const adapter = createBullMQAdapter(redisUrl);
  try {
    const [counts, workerCount, healthy] = await Promise.all([
      adapter.getJobCounts(),
      adapter.getWorkerCount(),
      adapter.healthCheck(),
    ]);

    return NextResponse.json({
      status: healthy ? "ok" : "degraded",
      queue: "generation-jobs",
      counts: {
        pending: counts.waiting + counts.delayed,
        active: counts.active,
        failed: counts.failed,
        completed: counts.completed,
      },
      workers: {
        count: workerCount,
        status: workerCount > 0 ? "active" : "inactive",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "error",
        error: err instanceof Error ? err.message : "unknown error",
      },
      { status: 503 },
    );
  } finally {
    await adapter.close();
  }
}
