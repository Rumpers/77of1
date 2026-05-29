/**
 * CrisisHelplineBubble — SB 243 / COMPLY-02 crisis helpline injection bubble.
 *
 * Rendered ABOVE the standard deflection bubble when an AI response contains
 * a known helpline phone number (server-injected per moderation.ts
 * composeFlaggedReply). Two-bubble layout per UI-SPEC "Crisis helpline
 * rendering":
 *
 *   ┌──────────────────────────────────────────────────┐
 *   │ ┃ <helpline text>                                │  ← amber border 4px
 *   │ ┃                                                │     amber-400 text
 *   └──────────────────────────────────────────────────┘     neutral-900 fill
 *
 *   [normal AI bubble — deflection]
 *
 * Visual contract (UI-SPEC Color §): amber-400 text on neutral-900 surface,
 * 4px amber-500 left border. No disclosure footer (injected system message,
 * not an AI message). ARIA: role="alert" aria-live="assertive" — screen
 * readers announce immediately.
 */

export interface CrisisHelplineBubbleProps {
  helplineText: string;
  locale: string;
}

export function CrisisHelplineBubble({
  helplineText,
  locale,
}: CrisisHelplineBubbleProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      lang={locale}
      className="border-l-4 border-[#f59e0b] bg-[#1a1a1a] text-[#fbbf24] p-3 my-2 rounded-r-md text-[0.9375rem] leading-snug whitespace-pre-line"
    >
      {helplineText}
    </div>
  );
}
