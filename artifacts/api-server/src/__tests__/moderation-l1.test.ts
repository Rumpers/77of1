// MOD-01 — L1 fan-input moderation via OpenAI omni-moderation-latest.
// Plan 02-05 GREEN. Unit: runL1Moderation invokes the registered
// IModeratorProvider, writes a safety_audit_log row on flag, composes the
// locale-aware reply, fires founder notify on high severity.
//
// Stubs global `fetch` to drive both OpenAI moderation AND notify-founder
// Telegram POST. Mocks @workspace/db so safety-audit's insert.values()
// resolves without a real PG.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ─── In-memory DB capture ────────────────────────────────────────────────────
const insertedRows: Array<Record<string, unknown>> = [];

vi.mock("@workspace/db", () => {
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((row: Record<string, unknown>) => {
        insertedRows.push(row);
        return Promise.resolve();
      }),
    })),
  };
  return { db, safetyAuditLogTable: {} };
});

// ─── Imports AFTER vi.mock ───────────────────────────────────────────────────
import { runL1Moderation } from "../lib/moderation.js";
import { resetProviderRegistry } from "../providers/registry.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function openAiResponse(body: {
  flagged: boolean;
  categories?: Record<string, boolean>;
  scores?: Record<string, number>;
}): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: "mod-id",
      model: "omni-moderation-latest",
      results: [
        {
          flagged: body.flagged,
          categories: body.categories ?? {},
          category_scores: body.scores ?? {},
        },
      ],
    }),
  } as Response;
}

beforeEach(() => {
  insertedRows.length = 0;
  process.env.OPENAI_API_KEY = "sk-test";
  process.env.MODERATOR_PROVIDER = "openai";
  delete process.env.FOUNDER_TELEGRAM_CHAT_ID;
  delete process.env.TELEGRAM_BOT_TOKEN_LALA;
  resetProviderRegistry();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetProviderRegistry();
});

const baseCtx = {
  text: "any text",
  locale: "en",
  creatorId: "creator-1",
  fanIdHash: "fan-hash-1",
  sessionId: "session-1",
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MOD-01: L1 fan-input moderation", () => {
  it("returns { flagged: false } when fan input is benign", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(openAiResponse({ flagged: false })),
    );

    const out = await runL1Moderation({ ...baseCtx, text: "hello :)" });
    expect(out.flagged).toBe(false);
    expect(out.reply).toBeUndefined();
    // No audit row written when not flagged
    expect(insertedRows).toHaveLength(0);
  });

  it("returns flagged=true with self-harm category + composed reply (JP helpline when locale=ja)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        openAiResponse({
          flagged: true,
          categories: { "self-harm": true, "self-harm/intent": true },
          scores: { "self-harm": 0.91, "self-harm/intent": 0.85 },
        }),
      ),
    );

    const out = await runL1Moderation({
      ...baseCtx,
      locale: "ja",
      text: "辛い、消えたい",
    });

    expect(out.flagged).toBe(true);
    expect(out.reply).toBeDefined();
    expect(out.reply).toContain("0120-279-338"); // D-02-05 JP helpline
    expect(out.primaryCategory).toBe("self-harm");
    expect(out.severity).toBe("high");
  });

  it("writes safety_audit_log row with hashed fan_id and crisis_type on flagged turn", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        openAiResponse({
          flagged: true,
          categories: { "self-harm": true },
          scores: { "self-harm": 0.92 },
        }),
      ),
    );

    await runL1Moderation({
      ...baseCtx,
      creatorId: "creator-X",
      fanIdHash: "deadbeef",
      sessionId: "session-XYZ",
      text: "hurt myself",
    });

    // Allow microtasks (writeSafetyAuditLog is fire-and-forget)
    await new Promise((r) => setTimeout(r, 30));

    expect(insertedRows.length).toBeGreaterThanOrEqual(1);
    const row = insertedRows[0]!;
    expect(row["creatorId"]).toBe("creator-X");
    expect(row["sessionId"]).toBe("session-XYZ");
    expect(row["crisisLevel"]).toBe("high");
    expect(row["crisisType"]).toBe("self-harm");
    expect(row["locale"]).toBe("en");
    // No raw fan id
    expect(row).not.toHaveProperty("fanId");
    expect(row).not.toHaveProperty("fan_id");
    // fanIdHash present and is sha256 of our supplied fanIdHash (safety-audit
    // hashes whatever string we pass it).
    expect(row["fanIdHash"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sexual flagged → reply uses sexual deflection (no helpline)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        openAiResponse({
          flagged: true,
          categories: { sexual: true },
          scores: { sexual: 0.88 },
        }),
      ),
    );

    const out = await runL1Moderation({
      ...baseCtx,
      locale: "en",
      text: "...",
    });

    expect(out.flagged).toBe(true);
    expect(out.reply).toContain("Tell me about your day instead?");
    expect(out.reply).not.toContain("988");
    expect(out.severity).toBe("high"); // sexual is high per severityFromCategories
  });

  it("provider failure (5xx → ProviderTransientError) FAILS OPEN — flagged=false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "down",
      } as Response),
    );

    const out = await runL1Moderation({ ...baseCtx, text: "hi" });
    // Fail-open contract: outage doesn't take the twin down; LLM proceeds.
    expect(out.flagged).toBe(false);
  });
});
