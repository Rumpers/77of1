// RED test for CHAT-03 — will GREEN when plan 02-02 ships api-server/src/lib/hmac-conversation.ts.
// Unit: signConversationId / verifyConversationId round-trip + tamper detection.
// Mocks @workspace/db per PATTERNS S7 (no DB needed for HMAC math).
import { describe, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  conversationMessagesTable: {},
}));

describe("CHAT-03: HMAC conversation_id binding", () => {
  it.todo(
    "GREENs in plan 02-02: signConversationId returns a token whose verifyConversationId(token) returns the original conversation_id",
  );
  it.todo(
    "GREENs in plan 02-02: verifyConversationId throws/returns null when the signature byte is flipped (tamper detection)",
  );
  it.todo(
    "GREENs in plan 02-02: signing uses env.HMAC_CONVERSATION_SECRET (length >=32) and SHA-256",
  );
  it.todo(
    "GREENs in plan 02-02: tokens expire after configured TTL (default 24h)",
  );
});
