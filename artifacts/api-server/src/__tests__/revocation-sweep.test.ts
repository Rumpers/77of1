// Unit tests for consent-revocation sweep logic — OF-103
// Tests the DB cancellation path with a mocked Drizzle db.
// Supabase mock replaced with Drizzle mock in 01-04c (last Supabase dep removed).
// SLA note: the ≤60s timing guarantee depends on the BullMQ worker
// picking up within ≤10s; this is verified separately in the
// integration test (revocation-sla.integration.test.ts).
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Logger } from "pino";

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
} as unknown as Logger;

// Mock @workspace/db and drizzle-orm before dynamic import of the module under test.
// The mocks are hoisted by Vitest's vi.mock() so they apply at module load time.
vi.mock("@workspace/db", () => ({
  db: {},
  generationJobsTable: {
    id: "id",
    creatorId: "creator_id",
    consentGrantId: "consent_grant_id",
    bullmqJobId: "bullmq_job_id",
    status: "status",
    errorMessage: "error_message",
    completedAt: "completed_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, _val: unknown) => ({ type: "eq" })),
  inArray: vi.fn((_col: unknown, _vals: unknown) => ({ type: "inArray" })),
  and: vi.fn((..._args: unknown[]) => ({ type: "and" })),
}));

// Build a minimal Drizzle-style db mock that returns controlled data.
function makeDrizzleMock(opts: {
  jobs?: { id: string; bullmqJobId: string | null; status: string }[];
  queryError?: Error;
}) {
  const updateWhere = vi.fn().mockResolvedValue([]);
  const updateSet = vi.fn().mockReturnValue({ where: updateWhere });
  const updateFn = vi.fn().mockReturnValue({ set: updateSet });

  const selectWhere = vi.fn().mockImplementation(() => {
    if (opts.queryError) return Promise.reject(opts.queryError);
    return Promise.resolve(opts.jobs ?? []);
  });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const selectFn = vi.fn().mockReturnValue({ from: selectFrom });

  return { select: selectFn, update: updateFn } as unknown as typeof import("@workspace/db").db;
}

describe("runRevocationSweep", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 0 when no active jobs exist", async () => {
    const { runRevocationSweep } = await import("../workers/revocation.js");
    const mockDb = makeDrizzleMock({ jobs: [] });
    const count = await runRevocationSweep(
      mockDb,
      { creatorId: "c1", consentGrantId: "g1", killSwitch: false },
      noopLogger,
    );
    expect(count).toBe(0);
  });

  it("returns count of cancelled jobs", async () => {
    const { runRevocationSweep } = await import("../workers/revocation.js");
    const mockDb = makeDrizzleMock({
      jobs: [
        { id: "j1", bullmqJobId: null, status: "queued" },
        { id: "j2", bullmqJobId: null, status: "processing" },
      ],
    });
    const count = await runRevocationSweep(
      mockDb,
      { creatorId: "c1", consentGrantId: "g1", killSwitch: false },
      noopLogger,
    );
    expect(count).toBe(2);
  });

  it("returns 0 on DB query error", async () => {
    const { runRevocationSweep } = await import("../workers/revocation.js");
    const mockDb = makeDrizzleMock({ queryError: new Error("connection refused") });
    const count = await runRevocationSweep(
      mockDb,
      { creatorId: "c1", consentGrantId: "g1", killSwitch: false },
      noopLogger,
    );
    expect(count).toBe(0);
  });

  it("kill-switch sweep cancels all jobs regardless of grant", async () => {
    const { runRevocationSweep } = await import("../workers/revocation.js");
    const mockDb = makeDrizzleMock({
      jobs: [
        { id: "j1", bullmqJobId: null, status: "queued" },
        { id: "j2", bullmqJobId: null, status: "queued" },
        { id: "j3", bullmqJobId: null, status: "processing" },
      ],
    });
    const count = await runRevocationSweep(
      mockDb,
      { creatorId: "c1", consentGrantId: null, killSwitch: true },
      noopLogger,
    );
    expect(count).toBe(3);
  });

  it("handles missing REDIS_URL without throwing", async () => {
    const { runRevocationSweep } = await import("../workers/revocation.js");
    const saved = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      const mockDb = makeDrizzleMock({
        jobs: [{ id: "j1", bullmqJobId: "bj1", status: "queued" }],
      });
      const count = await runRevocationSweep(
        mockDb,
        { creatorId: "c1", consentGrantId: "g1", killSwitch: false },
        noopLogger,
      );
      expect(count).toBe(1);
    } finally {
      if (saved !== undefined) process.env.REDIS_URL = saved;
    }
  });
});
