// lib/eval/src/__tests__/runner.e2e.test.ts
// RED until 04-02 implements runner.ts
//
// This test defines the runEval contract. It INTENTIONALLY FAILS in plan 04-01
// because runner.ts does not yet exist. Plan 04-02 must implement runner.ts
// to turn this GREEN.
//
// The test mocks all external dependencies (DB, providers, moderation) so no
// network or DB calls are made — same mocking discipline as escalation.test.ts.

import { describe, it, expect, vi } from "vitest";

// ─── Mock @workspace/db ───────────────────────────────────────────────────────
// Mirrors the pattern from escalation.test.ts

vi.mock("@workspace/db", () => {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    select: () => builder,
    insert: () => builder,
    values: () => builder,
    returning: () => Promise.resolve([{ id: "eval-run-test-id" }]),
    then: (resolve: (rows: unknown[]) => void) => Promise.resolve(resolve([])),
  };
  return {
    db: {
      select: () => builder,
      insert: () => builder,
      update: () => builder,
    },
    twinsTable: { id: "id", creatorId: "creator_id", characterCard: "character_card" },
    evalRunsTable: { id: "id", creatorId: "creator_id" },
    creatorsTable: { id: "id" },
    safetyAuditLogTable: {
      categoryScores: "category_scores",
      creatorId: "creator_id",
      fanIdHash: "fan_id_hash",
      createdAt: "created_at",
    },
  };
});

// ─── Mock drizzle-orm ─────────────────────────────────────────────────────────

vi.mock("drizzle-orm", () => ({
  eq: (_col: unknown, _val: unknown) => "eq",
  and: (..._args: unknown[]) => "and",
  desc: (_col: unknown) => "desc",
}));

// ─── Mock @workspace/providers (GmiClient) ────────────────────────────────────
// Returns a canned in-character reply so no real GMI API calls are made.

vi.mock("@workspace/providers", () => ({
  GmiClient: vi.fn().mockImplementation(() => ({
    post: vi.fn().mockResolvedValue({
      choices: [{ message: { content: "Hey! I'm so glad you're here, thanks for joining!" } }],
    }),
  })),
}));

// ─── Mock @workspace/twin-runtime/moderation ─────────────────────────────────
// Returns flagged=true for hard-limit/injection inputs, flagged=false otherwise.
// This is a stub; the real runner will register the factory at initialization.

vi.mock("@workspace/twin-runtime/moderation", () => ({
  setModeratorProviderFactory: vi.fn(),
  runL1Moderation: vi.fn().mockResolvedValue({ flagged: false }),
  runL3Moderation: vi.fn().mockResolvedValue({ flagged: false }),
  writeNonFlaggedScores: vi.fn().mockResolvedValue(undefined),
}));

// ─── Mock @workspace/twin-runtime/system-prompt ───────────────────────────────

vi.mock("@workspace/twin-runtime/system-prompt", () => ({
  buildSystemPrompt: vi.fn().mockReturnValue("You are a helpful creator twin."),
}));

// ─── The actual test — RED until runner.ts is implemented ────────────────────

// This import will fail at runtime until 04-02 creates runner.ts.
// @ts-expect-error runner.ts does not exist yet — RED until 04-02 implements it
import { runEval } from "../runner.js";

describe("runEval — end-to-end contract (RED: runner.ts not yet implemented)", () => {
  it("should return an EvalReport with totalCases=30 and all 4 category keys", async () => {
    const FAKE_CREATOR_ID = "00000000-0000-0000-0000-000000000001";

    const report = await runEval(FAKE_CREATOR_ID);

    // EvalReport contract assertions
    expect(report.totalCases).toBe(30);
    expect(report.creatorId).toBe(FAKE_CREATOR_ID);
    expect(report.ranAt).toBeInstanceOf(Date);

    // All 4 category keys must be present
    expect(report.byCategory).toHaveProperty("in-character");
    expect(report.byCategory).toHaveProperty("boundary-push");
    expect(report.byCategory).toHaveProperty("hard-limit");
    expect(report.byCategory).toHaveProperty("prompt-injection");

    // goLiveEligible derivation must be consistent with the boolean flags
    expect(report.goLiveEligible).toBe(report.passedHardLimit100 && report.passedInjection100);

    // totalPassed + totalFailed must equal totalCases
    expect(report.totalPassed + report.totalFailed).toBe(report.totalCases);
  });
});
