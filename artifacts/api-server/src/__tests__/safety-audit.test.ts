// Unit tests for safety audit log write path and Slack webhook payload (OF-161)
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { createHash } from "crypto";
import { writeSafetyAuditLog } from "../lib/safety-audit.js";

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Minimal Supabase mock
// ---------------------------------------------------------------------------
interface InsertCall {
  table: string;
  row: Record<string, unknown>;
}

function makeSupabaseMock(opts: { insertError?: string } = {}) {
  const calls: InsertCall[] = [];

  const mock = {
    _calls: calls,
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          calls.push({ table, row });
          return Promise.resolve({
            error: opts.insertError ? { message: opts.insertError } : null,
          });
        },
      };
    },
  };

  return mock as unknown as import("@supabase/supabase-js").SupabaseClient & {
    _calls: InsertCall[];
  };
}

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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("writeSafetyAuditLog — log write path", () => {
  it("stores fan_id_hash not raw fan_id", async () => {
    const supabase = makeSupabaseMock();
    writeSafetyAuditLog(supabase, baseEntry);
    await new Promise((r) => setTimeout(r, 50));

    expect(supabase._calls).toHaveLength(1);
    const row = supabase._calls[0]!.row;
    expect(row["fan_id_hash"]).toBe(sha256(baseEntry.fanId));
    expect(row).not.toHaveProperty("fan_id");
  });

  it("stores message_hash not raw text", async () => {
    const supabase = makeSupabaseMock();
    writeSafetyAuditLog(supabase, baseEntry);
    await new Promise((r) => setTimeout(r, 50));

    const row = supabase._calls[0]!.row;
    expect(row["message_hash"]).toBe(sha256(baseEntry.messageText));
    expect(row).not.toHaveProperty("messageText");
    expect(row).not.toHaveProperty("message_text");
  });

  it("does not throw when DB write fails", async () => {
    const supabase = makeSupabaseMock({ insertError: "connection timeout" });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => writeSafetyAuditLog(supabase, baseEntry)).not.toThrow();
    await new Promise((r) => setTimeout(r, 50));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("DB write failed"),
    );
  });

  it("sets alerted=false for non-high crisis levels", async () => {
    const supabase = makeSupabaseMock();
    writeSafetyAuditLog(supabase, { ...baseEntry, crisisLevel: "medium" });
    await new Promise((r) => setTimeout(r, 50));

    expect(supabase._calls[0]!.row["alerted"]).toBe(false);
  });

  it("sets alerted=true and fires Slack for crisis_level=high", async () => {
    const fetchCalls: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, init: RequestInit) => {
      fetchCalls.push({ url, body: JSON.parse(init.body as string) });
      return Promise.resolve({ ok: true } as Response);
    }));

    process.env.SAFETY_ALERT_WEBHOOK_URL = "https://hooks.slack.com/test";
    const supabase = makeSupabaseMock();

    writeSafetyAuditLog(supabase, {
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

    expect(supabase._calls[0]!.row["alerted"]).toBe(true);
  });

  it("does not throw when Slack webhook fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    process.env.SAFETY_ALERT_WEBHOOK_URL = "https://hooks.slack.com/test";

    const supabase = makeSupabaseMock();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      writeSafetyAuditLog(supabase, { ...baseEntry, crisisLevel: "high" }),
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

    const supabase = makeSupabaseMock();
    writeSafetyAuditLog(supabase, {
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
