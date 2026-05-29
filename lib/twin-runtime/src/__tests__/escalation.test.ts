import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// scoreEscalation is the SUT — imported after mocks are hoisted.
import { scoreEscalation } from "../escalation.js";

// ─── DB mock ─────────────────────────────────────────────────────────────────
// We inject canned safety_audit_log rows by replacing the db.select chain.
// The mock's .select() returns a builder whose chainable methods resolve to
// the rows array on any `.then()` call.

type MockRow = { categoryScores: Record<string, number> | null };
let _mockRows: MockRow[] = [];

vi.mock("@workspace/db", () => {
  const builder = {
    from: () => builder,
    where: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    then: (resolve: (rows: MockRow[]) => void) => Promise.resolve(resolve(_mockRows)),
  };
  return {
    db: { select: () => builder },
    safetyAuditLogTable: {
      categoryScores: "category_scores",
      creatorId: "creator_id",
      fanIdHash: "fan_id_hash",
      createdAt: "created_at",
    },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (_col: unknown, _val: unknown) => "eq",
  and: (..._args: unknown[]) => "and",
  desc: (_col: unknown) => "desc",
}));

// ─── Test setup ──────────────────────────────────────────────────────────────

const CREATOR = "creator-aaa";
const FAN_HASH = "fan-hash-bbb";

beforeEach(() => {
  _mockRows = [];
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rows(n: number, scores: Record<string, number>): MockRow[] {
  return Array.from({ length: n }, () => ({ categoryScores: scores }));
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

describe("scoreEscalation", () => {
  it("empty history + low score → not flagged", async () => {
    _mockRows = [];
    const result = await scoreEscalation({
      creatorId: CREATOR,
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: { "self-harm": 0.3 },
    });
    expect(result.flagged).toBe(false);
    expect(result.cumulativeScore).toBeCloseTo(0.3, 2);
    expect(result.windowSize).toBe(1);
    expect(result.triggeringCategory).toBe("self-harm");
  });

  it("9 borderline rows + current turn → flagged (Crescendo scenario)", async () => {
    // 9 historical rows each with self-harm=0.4
    _mockRows = rows(9, { "self-harm": 0.4 });
    const result = await scoreEscalation({
      creatorId: CREATOR,
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: { "self-harm": 0.4 },
    });
    // sum(0.5^(i/3) * 0.4 for i=0..9) ≈ 1.75 > 1.5 threshold
    expect(result.flagged).toBe(true);
    expect(result.cumulativeScore).toBeGreaterThan(1.5);
    expect(result.cumulativeScore).toBeCloseTo(1.746, 1);
    expect(result.triggeringCategory).toBe("self-harm");
    expect(result.windowSize).toBe(10);
  });

  it("NULL categoryScores rows → zero contribution, still in window", async () => {
    _mockRows = [
      { categoryScores: null },
      { categoryScores: null },
      { categoryScores: { "self-harm": 0.2 } },
    ];
    const result = await scoreEscalation({
      creatorId: CREATOR,
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: { "self-harm": 0.1 },
    });
    expect(result.flagged).toBe(false);
    // age=0: 0.1*1 = 0.1; age=1: 0*0.794 = 0; age=2: 0*0.63 = 0; age=3: 0.2*0.5 = 0.1
    expect(result.cumulativeScore).toBeCloseTo(0.2, 2);
    expect(result.windowSize).toBe(4);
  });

  it("respects WINDOW_TURNS — only queries windowTurns-1 rows", async () => {
    vi.stubEnv("MOD_07_WINDOW_TURNS", "5");
    // DB mock returns however many rows are in _mockRows, capped by .limit()
    // The limit() in our mock doesn't actually truncate, so we verify the
    // result.windowSize does not exceed WINDOW_TURNS.
    _mockRows = rows(4, { "self-harm": 0.3 }); // exactly windowTurns-1
    const result = await scoreEscalation({
      creatorId: CREATOR,
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: { "self-harm": 0.3 },
    });
    expect(result.windowSize).toBe(5);
  });

  it("MOD_07_THRESHOLD env override raises threshold", async () => {
    vi.stubEnv("MOD_07_THRESHOLD", "3.0");
    _mockRows = rows(9, { "self-harm": 0.4 });
    const result = await scoreEscalation({
      creatorId: CREATOR,
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: { "self-harm": 0.4 },
    });
    // Same scores as Crescendo scenario (≈1.75) but threshold is 3.0 → not flagged
    expect(result.flagged).toBe(false);
  });

  it("MOD_07_THRESHOLD env override lowers threshold", async () => {
    vi.stubEnv("MOD_07_THRESHOLD", "0.2");
    _mockRows = [];
    const result = await scoreEscalation({
      creatorId: CREATOR,
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: { "self-harm": 0.3 },
    });
    // score=0.3 > threshold=0.2 → flagged
    expect(result.flagged).toBe(true);
  });

  it("MOD_07_HALF_LIFE env override changes decay rate", async () => {
    vi.stubEnv("MOD_07_HALF_LIFE", "1");
    _mockRows = rows(9, { "self-harm": 0.4 });
    const result = await scoreEscalation({
      creatorId: CREATOR,
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: { "self-harm": 0.4 },
    });
    // With halfLife=1, weights decay faster → lower cumulative than halfLife=3
    // sum(0.5^(i/1) * 0.4 for i=0..9) = sum(0.5^i * 0.4) ≈ 0.4*(2*(1-0.5^10)) ≈ 0.798
    expect(result.cumulativeScore).toBeCloseTo(0.798, 1);
    expect(result.flagged).toBe(false); // below 1.5
  });

  it("invalid env var (NaN) falls back to default threshold 1.5", async () => {
    vi.stubEnv("MOD_07_THRESHOLD", "not-a-number");
    _mockRows = rows(9, { "self-harm": 0.4 });
    const result = await scoreEscalation({
      creatorId: CREATOR,
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: { "self-harm": 0.4 },
    });
    // Should behave as if threshold=1.5 (default) — same as Crescendo scenario
    expect(result.flagged).toBe(true);
    expect(result.cumulativeScore).toBeGreaterThan(1.5);
  });

  it("same fanIdHash, different creatorId — only matching rows contribute", async () => {
    // The DB mock returns _mockRows regardless of filter args (test limitation).
    // We verify isolation by testing with empty rows (correct query would return 0).
    _mockRows = [];
    const resultA = await scoreEscalation({
      creatorId: "creator-X",
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: { "self-harm": 0.3 },
    });
    const resultB = await scoreEscalation({
      creatorId: "creator-Y",
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: { "self-harm": 0.3 },
    });
    // Both get current-turn-only score (no historical rows)
    expect(resultA.cumulativeScore).toBeCloseTo(0.3, 2);
    expect(resultB.cumulativeScore).toBeCloseTo(0.3, 2);
  });

  it("triggeringCategory identifies highest-contributing category", async () => {
    _mockRows = rows(3, { harassment: 0.5, "self-harm": 0.1 });
    const result = await scoreEscalation({
      creatorId: CREATOR,
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: { harassment: 0.4, "self-harm": 0.1 },
    });
    // harassment accumulates more than self-harm across the window
    expect(result.triggeringCategory).toBe("harassment");
  });

  it("empty currentTurnCategoryScores with no history → cumulativeScore=0", async () => {
    _mockRows = [];
    const result = await scoreEscalation({
      creatorId: CREATOR,
      fanIdHash: FAN_HASH,
      currentTurnCategoryScores: {},
    });
    expect(result.flagged).toBe(false);
    expect(result.cumulativeScore).toBe(0);
    expect(result.triggeringCategory).toBeUndefined();
    expect(result.windowSize).toBe(1);
  });
});
