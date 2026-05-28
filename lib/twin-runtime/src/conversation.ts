// Conversation history persistence (CHAT-04) — per PATTERNS A2.
//
// Lazy-import @workspace/db (PATTERNS S1) so unit tests run without DATABASE_URL.
// Loads at most N turns ordered oldest-first; persistTurn writes a single row
// with retentionCategory='transcript' (D-03).
export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface PersistTurnInput {
  conversationId: string;
  creatorId: string;
  twinId?: string | null;
  role: ChatRole;
  content: string;
}

// DB imports lazy — see PATTERNS S1.
async function getDb() {
  const { db, conversationMessagesTable } = await import("@workspace/db");
  const { eq, desc } = await import("drizzle-orm");
  return { db, conversationMessagesTable, eq, desc };
}

// ─── loadHistory ─────────────────────────────────────────────────────────────
// Returns the last `limit` turns (default 20) for a given conversation_id,
// ordered oldest-first (chronological). Query is desc + slice + reverse to
// avoid scanning the entire history table when the conversation grows long.
export async function loadHistory(
  conversationId: string,
  limit = 20,
): Promise<ChatTurn[]> {
  const { db, conversationMessagesTable, eq, desc } = await getDb();
  const rows = await db
    .select({
      role: conversationMessagesTable.role,
      content: conversationMessagesTable.content,
    })
    .from(conversationMessagesTable)
    .where(eq(conversationMessagesTable.conversationId, conversationId))
    .orderBy(desc(conversationMessagesTable.createdAt))
    .limit(limit);
  // rows came back newest-first; reverse to chronological for the LLM context.
  const turns: ChatTurn[] = (rows as Array<{ role: ChatRole; content: string }>).map(
    (r) => ({ role: r.role, content: r.content }),
  );
  return turns.reverse();
}

// ─── persistTurn ─────────────────────────────────────────────────────────────
// Insert a single conversation message. Caller drives the role and twinId.
// retentionCategory is forced to 'transcript' (D-03 — 90-day TTL cleaned up
// by a Phase 4 cron).
export async function persistTurn(input: PersistTurnInput): Promise<void> {
  const { db, conversationMessagesTable } = await getDb();
  await db.insert(conversationMessagesTable).values({
    conversationId: input.conversationId,
    creatorId: input.creatorId,
    twinId: input.twinId ?? null,
    role: input.role,
    content: input.content,
    retentionCategory: "transcript",
  });
}
