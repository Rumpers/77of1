// GREEN test for CHAT-04 — loadHistory(conversationId, limit) returns ≤limit
// turns ordered oldest-first. Mocks @workspace/db per PATTERNS S7.
import { beforeEach, describe, expect, it, vi } from "vitest";

interface MockRow {
  role: "user" | "assistant";
  content: string;
}

let mockRows: MockRow[] = [];
let lastWhereArg: unknown = null;
let lastLimit: number | null = null;
let lastInsertedRow: Record<string, unknown> | null = null;

vi.mock("@workspace/db", () => {
  const conversationMessagesTable = {
    role: "role",
    content: "content",
    conversationId: "conversationId",
    createdAt: "createdAt",
  };

  const builder = {
    select: vi.fn(() => builder),
    from: vi.fn(() => builder),
    where: vi.fn((arg: unknown) => {
      lastWhereArg = arg;
      return builder;
    }),
    orderBy: vi.fn(() => builder),
    limit: vi.fn((n: number) => {
      lastLimit = n;
      // resolves to a thenable so `await` works
      return Promise.resolve(mockRows);
    }),
    insert: vi.fn(() => ({
      values: vi.fn((row: Record<string, unknown>) => {
        lastInsertedRow = row;
        return Promise.resolve();
      }),
    })),
  };

  const db = {
    select: builder.select,
    insert: builder.insert,
  };

  return { db, conversationMessagesTable };
});

vi.mock("drizzle-orm", () => ({
  eq: (col: unknown, value: unknown) => ({ op: "eq", col, value }),
  desc: (col: unknown) => ({ op: "desc", col }),
}));

beforeEach(() => {
  mockRows = [];
  lastWhereArg = null;
  lastLimit = null;
  lastInsertedRow = null;
});

describe("CHAT-04: loadHistory", () => {
  it("returns at most `limit` turns even when more exist (limit enforced)", async () => {
    const { loadHistory } = await import("../lib/conversation.js");
    // Simulate DB returning 20 rows (the .limit(20) cap)
    mockRows = Array.from({ length: 20 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as MockRow["role"],
      // newest-first ordering (desc) — index 0 is the most recent
      content: `turn-${19 - i}`,
    }));

    const turns = await loadHistory("conv-many", 20);
    expect(turns).toHaveLength(20);
    expect(lastLimit).toBe(20);
  });

  it("returns ordered oldest-first (reverse of desc query)", async () => {
    const { loadHistory } = await import("../lib/conversation.js");
    // DB returns rows desc (newest-first): turn-2, turn-1, turn-0
    mockRows = [
      { role: "assistant", content: "turn-2" },
      { role: "user", content: "turn-1" },
      { role: "assistant", content: "turn-0" },
    ];

    const turns = await loadHistory("conv-order", 20);
    expect(turns.map((t) => t.content)).toEqual([
      "turn-0",
      "turn-1",
      "turn-2",
    ]);
  });

  it("returns turns with {role, content} shape only", async () => {
    const { loadHistory } = await import("../lib/conversation.js");
    mockRows = [{ role: "user", content: "hi" }];
    const turns = await loadHistory("conv-shape", 20);
    expect(turns).toHaveLength(1);
    expect(turns[0]).toEqual({ role: "user", content: "hi" });
  });

  it("returns empty array on cold-start conversation", async () => {
    const { loadHistory } = await import("../lib/conversation.js");
    mockRows = [];
    const turns = await loadHistory("conv-cold", 20);
    expect(turns).toEqual([]);
  });

  it("default limit is 20 when not specified", async () => {
    const { loadHistory } = await import("../lib/conversation.js");
    mockRows = [];
    await loadHistory("conv-default-limit");
    expect(lastLimit).toBe(20);
  });
});

describe("CHAT-04: persistTurn", () => {
  it("inserts a row with retentionCategory='transcript'", async () => {
    const { persistTurn } = await import("../lib/conversation.js");
    await persistTurn({
      conversationId: "conv-1",
      creatorId: "creator-1",
      twinId: "twin-1",
      role: "user",
      content: "hello",
    });
    expect(lastInsertedRow).toMatchObject({
      conversationId: "conv-1",
      creatorId: "creator-1",
      twinId: "twin-1",
      role: "user",
      content: "hello",
      retentionCategory: "transcript",
    });
  });

  it("normalises missing twinId to null", async () => {
    const { persistTurn } = await import("../lib/conversation.js");
    await persistTurn({
      conversationId: "conv-2",
      creatorId: "creator-2",
      role: "assistant",
      content: "hi back",
    });
    expect(lastInsertedRow?.twinId).toBeNull();
  });
});
