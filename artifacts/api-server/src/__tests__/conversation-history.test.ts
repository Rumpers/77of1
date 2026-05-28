// RED test for CHAT-04 — will GREEN when plan 02-02 ships conversation history load (last N=20 turns).
// Unit: loadHistory(conversationId, 20) returns ordered [user, assistant, ...] array.
// Mocks @workspace/db per PATTERNS S7.
import { describe, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  conversationMessagesTable: {},
}));

describe("CHAT-04: conversation history load", () => {
  it.todo(
    "GREENs in plan 02-02: loadHistory returns last 20 messages for a conversation_id, ordered ASC by created_at",
  );
  it.todo(
    "GREENs in plan 02-02: returns empty array when conversation_id has no messages (cold start)",
  );
  it.todo(
    "GREENs in plan 02-02: never returns more than 20 messages even if history is longer (limit enforced)",
  );
});
