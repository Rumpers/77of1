// Conversation-id derivation + single-tenant creator resolution for fan-twin.
//
// Per D-02-01 (single-tenant fan-twin): one Telegram bot token = one creator.
// At N=1 we read CREATOR_HANDLE_FAN_TWIN at startup (or first lookup) and
// resolve the creator by handle. Multi-tenant deep-link routing
// (`/start <handle>`) is deferred to v2.
//
// `deriveTelegramConversationId(chatId, creatorId)` is re-exported from
// twin-runtime so the webhook handler and the worker compute identical
// conversation_ids for the same chat + creator pair (CHAT-03).

export { deriveTelegramConversationId } from "@workspace/twin-runtime/hmac-conversation";

let _cached: { id: string; handle: string } | null = null;

// Resolve the single creator wired to this fan-twin bot.
// Reads `CREATOR_HANDLE_FAN_TWIN` env var, then loads the matching
// `creators` row via @workspace/db. Throws if env unset or creator missing.
// Result is cached in-process; restart picks up env changes.
export async function resolveCreatorForFanTwinBot(): Promise<{
  id: string;
  handle: string;
}> {
  if (_cached) return _cached;

  const handle = process.env.CREATOR_HANDLE_FAN_TWIN;
  if (!handle || handle.length === 0) {
    throw new Error(
      "CREATOR_HANDLE_FAN_TWIN is not set. Per D-02-01 the fan-twin is single-tenant; " +
        "set the creator handle this bot serves in Replit Secrets.",
    );
  }

  const { db, creatorsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const row = await db
    .select({ id: creatorsTable.id, handle: creatorsTable.handle })
    .from(creatorsTable)
    .where(eq(creatorsTable.handle, handle))
    .limit(1)
    .then(
      (rows: Array<{ id: string; handle: string }>) => rows[0] ?? null,
    );

  if (!row) {
    throw new Error(
      `fan-twin: creator with handle="${handle}" not found in creators table. ` +
        "Verify CREATOR_HANDLE_FAN_TWIN matches a real creator row.",
    );
  }
  _cached = row;
  return row;
}

// Test-only: clear the cached creator (used by webhook-ack test which stubs db).
export function __resetCreatorCacheForTests(): void {
  _cached = null;
}
