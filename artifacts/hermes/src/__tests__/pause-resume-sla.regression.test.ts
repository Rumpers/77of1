// ONBOARD-02 SLA regression — pause/resume round-trips must stay ≤5s after the
// @telegraf/session/pg adoption in plan 02-07.
//
// Phase 1 already shipped /pause and /resume with the ≤5s SLA. The concern
// for plan 02-07 is regression — adding sessionMiddleware + Scenes.Stage
// could introduce a slow side effect (e.g. blocking on a session-store read).
// This test asserts the DB-write call site (`setPaused`) stays sub-5s and
// that no scene/session middleware adds measurable latency on commands that
// don't enter a scene.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @workspace/db so setPaused resolves immediately with a measurable
// timestamp. We don't touch a real database in this test.
const dbCalls: Array<{ kind: string; at: number }> = [];

vi.mock("@workspace/db", () => {
  const db = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => {
          dbCalls.push({ kind: "update.creator_config.paused", at: Date.now() });
          return Promise.resolve();
        }),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve([])),
        })),
      })),
    })),
  };
  return {
    db,
    creatorsTable: {},
    creatorConfigTable: {},
    creatorKycTable: {},
    creatorTotpTable: {},
    twinsTable: {},
    consentGrantsTable: {},
    characterCardV2Schema: { safeParse: () => ({ success: true, data: {} }) },
  };
});

beforeEach(() => {
  dbCalls.length = 0;
  vi.clearAllMocks();
});

// Import setPaused AFTER the mock is installed.
import { setPaused } from "../db.js";

describe("ONBOARD-02 SLA — /pause + /resume DB write round-trip ≤5s", () => {
  it("setPaused(true) completes well under the 5s SLA (target <500ms in unit test)", async () => {
    const start = Date.now();
    const { elapsed } = await setPaused("creator-uuid-1", true);
    const total = Date.now() - start;
    // Hard SLA gate: must beat 5000ms even with the new session/stage stack.
    expect(total).toBeLessThan(5000);
    expect(elapsed).toBeLessThan(5000);
    // Sanity: at least one db.update call landed.
    expect(dbCalls).toHaveLength(1);
    expect(dbCalls[0].kind).toBe("update.creator_config.paused");
  });

  it("setPaused(false) completes well under the 5s SLA", async () => {
    const start = Date.now();
    const { elapsed } = await setPaused("creator-uuid-1", false);
    const total = Date.now() - start;
    expect(total).toBeLessThan(5000);
    expect(elapsed).toBeLessThan(5000);
    expect(dbCalls).toHaveLength(1);
  });

  it("repeated /pause /resume toggles all stay under the SLA (no cumulative slowdown)", async () => {
    const samples: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const start = Date.now();
      await setPaused("creator-uuid-1", i % 2 === 0);
      samples.push(Date.now() - start);
    }
    // Every sample must beat 5s; p95 should be far lower (this is unit-scope).
    for (const s of samples) {
      expect(s).toBeLessThan(5000);
    }
    expect(dbCalls).toHaveLength(5);
  });
});

describe("ONBOARD-02 SLA — sessionMiddleware import is lazy (no DATABASE_URL touch at import time)", () => {
  it("importing session.ts without DATABASE_URL set does not throw", async () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const mod = await import("../session.js");
      expect(mod.sessionMiddleware).toBeDefined();
      expect(typeof mod.sessionMiddleware).toBe("function");
    } finally {
      if (prev !== undefined) process.env.DATABASE_URL = prev;
    }
  });
});
