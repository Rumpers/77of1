// Hard-stop enforcement — OF-62
// Post-generation filter: checks whether generated text contains a forbidden topic.
// Used by the GMI adapter for max-2-retry regeneration before graceful decline.

// containsHardStop does case-insensitive substring matching against each forbidden topic.
// Simple and fast — no regex, no NLP. Good enough for Slice 1.
export function containsHardStop(
  text: string,
  forbiddenTopics: string[]
): boolean {
  if (forbiddenTopics.length === 0) return false;
  const lower = text.toLowerCase();
  return forbiddenTopics.some((topic) => lower.includes(topic.toLowerCase()));
}

// buildGracefulDecline returns a decline in the creator's voice that doesn't
// break character. Fan endearment is injected so it still sounds personal.
export function buildGracefulDecline(fanEndearment: string): string {
  return (
    `Aww, ${fanEndearment} — that's not something I can chat about! 💕 ` +
    `Let's talk about something else though — what else is on your mind?`
  );
}
