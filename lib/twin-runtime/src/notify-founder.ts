// L5 founder notification — fire-and-forget Telegram Bot API call.
// PATTERNS A9 + D-02-04: direct outbound HTTP to api.telegram.org from the
// api-server (no Telegraf import, no BullMQ job). Mirrors safety-audit.ts
// `fireSlackAlert` shape (PATTERNS S2).
//
// Required env:
//   - TELEGRAM_BOT_TOKEN_LALA  (D-02-07)
//   - FOUNDER_TELEGRAM_CHAT_ID (numeric chat id of the founder DM)
// When either is missing, logs a warning and returns — never throws.

async function notifyFounder(text: string): Promise<void> {
  const chatId = process.env["FOUNDER_TELEGRAM_CHAT_ID"];
  const token = process.env["TELEGRAM_BOT_TOKEN_LALA"];
  if (!chatId || !token) {
    console.warn(
      "[notify-founder] FOUNDER_TELEGRAM_CHAT_ID or TELEGRAM_BOT_TOKEN_LALA not set — skipping",
    );
    return;
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      },
    );
    if (!res.ok) {
      console.error(`[notify-founder] Telegram returned ${res.status}`);
    }
  } catch (err) {
    console.error(
      `[notify-founder] POST failed: ${(err as Error).message}`,
    );
  }
}

/**
 * Fire-and-forget founder alert. Caller MUST NOT await.
 * Patterns S2 — `void (async () => {...})()` shape ensures rejection
 * never escapes back to the request handler.
 */
export function notifyFounderAsync(text: string): void {
  void (async () => {
    await notifyFounder(text);
  })();
}
