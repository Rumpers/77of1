// Unit tests for safety audit log write path and Slack webhook payload (OF-161)
// Updated for Drizzle-backed writeSafetyAuditLog (no SupabaseClient parameter).
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createHash } from "crypto";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Mock @workspace/db — vi.mock must reference the module by the same ID that
// safety-audit.ts imports. The mock intercepts db.insert().values() calls and
// records them for assertions.
// ---------------------------------------------------------------------------
interface InsertedRow {
  [key: string]: unknown;
}

const mockInsertedRows: InsertedRow[] = [];
let mockInsertError: string | null = null;

vi.mock("@workspace/db", () => {
  const db = {
    insert: vi.fn(() => ({
      values: vi.fn((row: InsertedRow) => {
        mockInsertedRows.push(row);
        if (mockInsertError) {
          return Promise.reject(new Error(mockInsertError));
        }
        return Promise.resolve();
      }),
    })),
  };
  const safetyAuditLogTable = {};
  return { db, safetyAuditLogTable };
});

// Import AFTER the mock is established
import { writeSafetyAuditLog } from "../lib/safety-audit.js";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const baseEntry = {
  creatorId: "creator-uuid-1",
  fanId: "fan-uuid-1",
  sessionId: "session-abc",
  messageText: "hello world",
  crisisLevel: "none" as const,
  locale: "en",
  responseSent: false,
  twinPaused: false,
};

beforeEach(() => {
  delete process.env.SAFETY_ALERT_WEBHOOK_URL;
  vi.restoreAllMocks();
  mockInsertedRows.length = 0;
  mockInsertError = null;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("writeSafetyAuditLog — log write path", () => {
  it("stores fan_id_hash not raw fan_id", async () => {
    writeSafetyAuditLog(baseEntry);
    await new Promise((r) => setTimeout(r, 50));

    expect(mockInsertedRows).toHaveLength(1);
    const row = mockInsertedRows[0]!;
    expect(row["fanIdHash"]).toBe(sha256(baseEntry.fanId));
    expect(row).not.toHaveProperty("fanId");
    expect(row).not.toHaveProperty("fan_id");
  });

  it("stores message_hash not raw text", async () => {
    writeSafetyAuditLog(baseEntry);
    await new Promise((r) => setTimeout(r, 50));

    const row = mockInsertedRows[0]!;
    expect(row["messageHash"]).toBe(sha256(baseEntry.messageText));
    expect(row).not.toHaveProperty("messageText");
    expect(row).not.toHaveProperty("message_text");
  });

  it("sets retentionCategory to 'audit'", async () => {
    writeSafetyAuditLog(baseEntry);
    await new Promise((r) => setTimeout(r, 50));

    const row = mockInsertedRows[0]!;
    expect(row["retentionCategory"]).toBe("audit");
  });

  it("does not throw when DB write fails", async () => {
    mockInsertError = "connection timeout";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => writeSafetyAuditLog(baseEntry)).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("DB write failed"),
    );
  });

  it("sets alerted=false for non-high crisis levels", async () => {
    writeSafetyAuditLog({ ...baseEntry, crisisLevel: "medium" });
    await new Promise((r) => setTimeout(r, 50));

    expect(mockInsertedRows[0]!["alerted"]).toBe(false);
  });

  it("sets alerted=true and fires Slack for crisis_level=high", async () => {
    const fetchCalls: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, init: RequestInit) => {
      fetchCalls.push({ url, body: JSON.parse(init.body as string) });
      return Promise.resolve({ ok: true } as Response);
    }));

    process.env.SAFETY_ALERT_WEBHOOK_URL = "https://hooks.slack.com/test";

    writeSafetyAuditLog({
      ...baseEntry,
      crisisLevel: "high",
      crisisType: "self_harm",
      sessionId: "session-high-1",
    });
    await new Promise((r) => setTimeout(r, 100));

    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0]!.url).toBe("https://hooks.slack.com/test");

    const bodyStr = JSON.stringify(fetchCalls[0]!.body);
    expect(bodyStr).toContain("creator-uuid-1");
    expect(bodyStr).toContain("session-high-1");
    expect(bodyStr).toContain("self_harm");
    expect(bodyStr).not.toContain("fan-uuid-1");

    expect(mockInsertedRows[0]!["alerted"]).toBe(true);
  });

  it("does not throw when Slack webhook fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    process.env.SAFETY_ALERT_WEBHOOK_URL = "https://hooks.slack.com/test";

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      writeSafetyAuditLog({ ...baseEntry, crisisLevel: "high" }),
    ).not.toThrow();
    await new Promise((r) => setTimeout(r, 100));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Slack webhook POST failed"),
    );
  });
});

describe("Slack webhook payload — no fan PII", () => {
  it("never includes fan_id in Slack payload", async () => {
    const fetchCalls: { body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      fetchCalls.push({ body: JSON.parse(init.body as string) });
      return Promise.resolve({ ok: true } as Response);
    }));
    process.env.SAFETY_ALERT_WEBHOOK_URL = "https://hooks.slack.com/test2";

    writeSafetyAuditLog({
      creatorId: "creator-99",
      fanId: "fan-pii-data",
      sessionId: "session-99",
      messageText: "sensitive content",
      crisisLevel: "high",
      crisisType: "suicide",
      locale: "ja",
      confidence: 0.97,
      responseSent: true,
      twinPaused: true,
    });
    await new Promise((r) => setTimeout(r, 100));

    const bodyStr = JSON.stringify(fetchCalls[0]!.body);
    expect(bodyStr).not.toContain("fan-pii-data");
    expect(bodyStr).not.toContain("sensitive content");
    expect(bodyStr).toContain("creator-99");
    expect(bodyStr).toContain("session-99");
    expect(bodyStr).toContain("suicide");
    expect(bodyStr).toContain("ja");
  });
});
