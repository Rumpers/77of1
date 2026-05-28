// MOD-03 — L3 LLM-output moderation. Plan 02-05 GREEN.
// Verifies runL3Moderation contract: passes content through when clean,
// replaces with deflection when flagged, writes audit row on flag.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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

import { runL3Moderation } from "../lib/moderation.js";
import { resetProviderRegistry } from "../providers/registry.js";

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
  resetProviderRegistry();
});

afterEach(() => {
  vi.restoreAllMocks();
  resetProviderRegistry();
});

const baseCtx = {
  text: "any output",
  locale: "en",
  creatorId: "creator-1",
  fanIdHash: "fan-hash-1",
  sessionId: "session-1",
};

describe("MOD-03: L3 LLM-output moderation", () => {
  it("passes through assistant content unchanged when L3 flagged=false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(openAiResponse({ flagged: false })),
    );

    const out = await runL3Moderation({
      ...baseCtx,
      text: "I had a great day! ☀️",
    });

    expect(out.flagged).toBe(false);
    expect(out.reply).toBeUndefined();
    expect(insertedRows).toHaveLength(0);
  });

  it("replaces assistant content with locale-aware deflection when flagged", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        openAiResponse({
          flagged: true,
          categories: { sexual: true },
          scores: { sexual: 0.93 },
        }),
      ),
    );

    const out = await runL3Moderation({
      ...baseCtx,
      locale: "ja",
      text: "<flagged-LLM-output>",
    });

    expect(out.flagged).toBe(true);
    expect(out.reply).toBe("その話はちょっと…。今日はどんな一日だった？");
  });

  it("writes safety_audit_log entry with crisis_type matching flagged category", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        openAiResponse({
          flagged: true,
          categories: { harassment: true },
          scores: { harassment: 0.81 },
        }),
      ),
    );

    await runL3Moderation({
      ...baseCtx,
      text: "<rude>",
    });
    await new Promise((r) => setTimeout(r, 30));

    expect(insertedRows.length).toBeGreaterThanOrEqual(1);
    const row = insertedRows[0]!;
    expect(row["crisisType"]).toBe("harassment");
    expect(row["crisisLevel"]).toBe("medium");
  });

  it("fires founder notify (Telegram POST) on high-severity flags when FOUNDER_TELEGRAM_CHAT_ID set", async () => {
    process.env.FOUNDER_TELEGRAM_CHAT_ID = "123456";
    process.env.TELEGRAM_BOT_TOKEN_LALA = "fake-bot-token";

    const fetchCalls: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string, init: RequestInit) => {
        fetchCalls.push({ url, init });
        // First call is OpenAI moderation; subsequent calls are Telegram notify.
        if (url.includes("openai.com") || url.includes("oai.helicone")) {
          return Promise.resolve(
            openAiResponse({
              flagged: true,
              categories: { "self-harm": true },
              scores: { "self-harm": 0.94 },
            }),
          );
        }
        return Promise.resolve({ ok: true, status: 200 } as Response);
      }),
    );

    await runL3Moderation({
      ...baseCtx,
      text: "<dangerous-output>",
    });
    // notifyFounderAsync is fire-and-forget — give the microtask queue time
    await new Promise((r) => setTimeout(r, 50));

    const telegramCall = fetchCalls.find((c) =>
      c.url.includes("api.telegram.org"),
    );
    expect(telegramCall).toBeDefined();
    const body = JSON.parse(telegramCall!.init.body as string);
    expect(body.chat_id).toBe("123456");
    expect(body.text).toContain("L3");
    expect(body.text).toContain("self-harm");
  });

  it("does NOT fire founder notify on medium-severity flags (harassment)", async () => {
    process.env.FOUNDER_TELEGRAM_CHAT_ID = "123456";
    process.env.TELEGRAM_BOT_TOKEN_LALA = "fake-bot-token";

    const fetchCalls: Array<{ url: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        fetchCalls.push({ url });
        if (url.includes("openai.com") || url.includes("oai.helicone")) {
          return Promise.resolve(
            openAiResponse({
              flagged: true,
              categories: { harassment: true },
              scores: { harassment: 0.78 },
            }),
          );
        }
        return Promise.resolve({ ok: true, status: 200 } as Response);
      }),
    );

    await runL3Moderation({
      ...baseCtx,
      text: "<harassment-output>",
    });
    await new Promise((r) => setTimeout(r, 50));

    const telegramCall = fetchCalls.find((c) =>
      c.url.includes("api.telegram.org"),
    );
    expect(telegramCall).toBeUndefined();
  });
});
