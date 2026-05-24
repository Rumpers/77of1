// Surface formatter — shapes raw LLM output for social or fan_page destinations.

import type { ShareableSurface } from "./shareable-prompt.js";

const HASHTAG_POOL = [
  "#CreatorLife",
  "#ExclusiveContent",
  "#JoinNow",
  "#ForYou",
  "#FYP",
  "#ContentCreator",
  "#OnlyFans",
  "#LinkInBio",
] as const;

function pickHashtags(creatorId: string, topic: string, count = 3): string[] {
  const seed = [...creatorId, ...topic].reduce(
    (h, c) => (((h << 5) + h) ^ c.charCodeAt(0)) >>> 0,
    5381
  );
  const tags: string[] = [];
  for (let i = 0; i < count; i++) {
    tags.push(HASHTAG_POOL[(seed + i) % HASHTAG_POOL.length]);
  }
  return [...new Set(tags)];
}

export interface FormattedContent {
  text: string;
  hashtags?: string[];
}

export function formatForSurface(
  rawText: string,
  surface: ShareableSurface,
  creatorId: string,
  topic: string
): FormattedContent {
  if (surface === "fan_page") {
    return { text: rawText };
  }

  const trimmed =
    rawText.length > 280 ? rawText.slice(0, 277).trimEnd() + "…" : rawText;
  return {
    text: trimmed,
    hashtags: pickHashtags(creatorId, topic),
  };
}
