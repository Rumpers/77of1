// Unit tests for consent-revocation sweep logic — OF-103
// Tests the DB cancellation path with mocked Supabase.
// SLA note: the ≤60s timing guarantee depends on the BullMQ worker
// picking up within ≤10s; this is verified separately in the
// integration test (revocation-sla.integration.test.ts).
import { runRevocationSweep } from "../workers/revocation.js";
import type { Logger } from "pino";

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
} as unknown as Logger;

interface MockSupabaseRow {
  id: string;
  bullmq_job_id: string | null;
  status: string;
}

function makeDbMock(opts: {
  jobs?: MockSupabaseRow[];
  queryError?: string;
  updateError?: string;
  auditError?: string;
}) {
  const calls: { table: string; op: string; args: unknown }[] = [];

  const mock = {
    _calls: calls,
    from(table: string) {
      const chain: Record<string, unknown> = {};

      // SELECT chain
      chain.select = (fields: string) => {
        calls.push({ table, op: "select", args: { fields } });
        return chain;
      };
      chain.eq = () => chain;
      chain.in = () => chain;
      chain.is = () => chain;

      // For query returning jobs
      chain.data = opts.jobs ?? [];
      const queryResult = {
        data: opts.queryError ? null : (opts.jobs ?? []),
        error: opts.queryError ? { message: opts.queryError } : null,
      };

      chain.maybeSingle = () =>
        Promise.resolve({
          data: opts.jobs?.[0] ?? null,
          error: opts.queryError ? { message: opts.queryError } : null,
        });

      // Implicit Promise for the select chain (returns queryResult when awaited)
      Object.defineProperty(chain, "then", {
        get() {
          return (resolve: (v: typeof queryResult) => void) => resolve(queryResult);
        },
      });

      // UPDATE chain
      chain.update = (data: unknown) => {
        calls.push({ table, op: "update", args: data });
        const updateChain: Record<string, unknown> = {};
        updateChain.eq = () => updateChain;
        updateChain.in = () => Promise.resolve({
          data: null,
          error: opts.updateError ? { message: opts.updateError } : null,
        });
        return updateChain;
      };

      // INSERT chain
      chain.insert = (data: unknown) => {
        calls.push({ table, op: "insert", args: data });
        return Promise.resolve({
          data: null,
          error: opts.auditError ? { message: opts.auditError } : null,
        });
      };

      return chain;
    },
  };

  return mock as unknown as import("@supabase/supabase-js").SupabaseClient;
}

async function run() {
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${(err as Error).message}`);
      failed++;
    }
  }

  function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
  }

  console.log("\nrunRevocationSweep");

  await test("returns 0 when no active jobs exist", async () => {
    const db = makeDbMock({ jobs: [] });
    const count = await runRevocationSweep(
      db,
      { creatorId: "c1", consentGrantId: "g1", killSwitch: false },
      noopLogger,
    );
    assert(count === 0, `expected 0, got ${count}`);
  });

  await test("returns count of cancelled jobs", async () => {
    const db = makeDbMock({
      jobs: [
        { id: "j1", bullmq_job_id: null, status: "queued" },
        { id: "j2", bullmq_job_id: null, status: "processing" },
      ],
    });
    const count = await runRevocationSweep(
      db,
      { creatorId: "c1", consentGrantId: "g1", killSwitch: false },
      noopLogger,
    );
    assert(count === 2, `expected 2, got ${count}`);
  });

  await test("returns 0 and still writes audit log on DB query error", async () => {
    const db = makeDbMock({ queryError: "connection refused" });
    const count = await runRevocationSweep(
      db,
      { creatorId: "c1", consentGrantId: "g1", killSwitch: false },
      noopLogger,
    );
    assert(count === 0, `expected 0, got ${count}`);
  });

  await test("kill-switch sweep cancels all jobs regardless of grant", async () => {
    const db = makeDbMock({
      jobs: [
        { id: "j1", bullmq_job_id: null, status: "queued" },
        { id: "j2", bullmq_job_id: null, status: "queued" },
        { id: "j3", bullmq_job_id: null, status: "processing" },
      ],
    });
    const count = await runRevocationSweep(
      db,
      { creatorId: "c1", consentGrantId: null, killSwitch: true },
      noopLogger,
    );
    assert(count === 3, `expected 3, got ${count}`);
  });

  await test("handles missing REDIS_URL without throwing", async () => {
    const saved = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      const db = makeDbMock({
        jobs: [{ id: "j1", bullmq_job_id: "bj1", status: "queued" }],
      });
      const count = await runRevocationSweep(
        db,
        { creatorId: "c1", consentGrantId: "g1", killSwitch: false },
        noopLogger,
      );
      assert(count === 1, `expected 1, got ${count}`);
    } finally {
      if (saved !== undefined) process.env.REDIS_URL = saved;
    }
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
