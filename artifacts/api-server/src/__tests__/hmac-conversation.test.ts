// GREEN test for CHAT-03 — HMAC conversation_id round-trip + tamper detection.
// Mocks @workspace/db per PATTERNS S7 (no DB needed for HMAC math).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  conversationMessagesTable: {},
}));

const TEST_SECRET = "x".repeat(48); // ≥32 chars required by hmac-conversation

let priorSecret: string | undefined;

beforeEach(() => {
  priorSecret = process.env.HMAC_CONVERSATION_SECRET;
  process.env.HMAC_CONVERSATION_SECRET = TEST_SECRET;
  vi.resetModules();
});

afterEach(() => {
  if (priorSecret === undefined) delete process.env.HMAC_CONVERSATION_SECRET;
  else process.env.HMAC_CONVERSATION_SECRET = priorSecret;
});

describe("CHAT-03: HMAC conversation_id binding", () => {
  it("signConversationId is deterministic and returns a 32-hex string", async () => {
    const mod = await import("../lib/hmac-conversation.js");
    const sig1 = mod.signConversationId("abc123");
    const sig2 = mod.signConversationId("abc123");
    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[0-9a-f]{32}$/);
  });

  it("verifyConversationId round-trips a freshly minted token", async () => {
    const mod = await import("../lib/hmac-conversation.js");
    const { id, token } = mod.newWebConversationId();
    expect(mod.verifyConversationId(token)).toBe(id);
  });

  it("verifyConversationId returns null when the token is tampered", async () => {
    const mod = await import("../lib/hmac-conversation.js");
    const { token } = mod.newWebConversationId();
    // Flip the last char of the signature
    const flipped = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(mod.verifyConversationId(flipped)).toBeNull();
  });

  it("verifyConversationId returns null for malformed input", async () => {
    const mod = await import("../lib/hmac-conversation.js");
    expect(mod.verifyConversationId("")).toBeNull();
    expect(mod.verifyConversationId("nodothere")).toBeNull();
    expect(mod.verifyConversationId(".onlydot")).toBeNull();
    expect(mod.verifyConversationId("onlydot.")).toBeNull();
  });

  it("newWebConversationId yields 32-hex id + matching token", async () => {
    const mod = await import("../lib/hmac-conversation.js");
    const { id, token } = mod.newWebConversationId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(token.startsWith(`${id}.`)).toBe(true);
    expect(mod.verifyConversationId(token)).toBe(id);
  });

  it("deriveTelegramConversationId is deterministic for same chatId+creatorId", async () => {
    const mod = await import("../lib/hmac-conversation.js");
    const a = mod.deriveTelegramConversationId(12345, "creator-uuid");
    const b = mod.deriveTelegramConversationId(12345, "creator-uuid");
    const c = mod.deriveTelegramConversationId(12346, "creator-uuid");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });

  it("signConversationId throws when HMAC_CONVERSATION_SECRET is missing", async () => {
    delete process.env.HMAC_CONVERSATION_SECRET;
    vi.resetModules();
    const mod = await import("../lib/hmac-conversation.js");
    expect(() => mod.signConversationId("anything")).toThrow(
      /HMAC_CONVERSATION_SECRET/,
    );
  });
});
