// Deterministic variation layer — ensures two creators using the same template skeleton
// produce textually distinct outputs, preventing IG/TikTok algorithmic suppression.
//
// Variation = f(creatorId, templateId). Same inputs → same output every time.
// Different creator IDs → different style directives and temperature offsets.

export interface VariationParams {
  styleDirective: string;
  temperatureOffset: number; // ±0.15 added to base temperature
  seed: number;              // 0–1 deterministic float
}

const STYLE_DIRECTIVES = [
  "Use short, punchy sentences. Energy. Impact.",
  "Write in warm, flowing prose. Draw your audience in with emotion.",
  "Be playful and a little cheeky. Let your wit shine through.",
  "Lead with a vulnerable personal moment before the main point.",
  "Open with a bold declarative statement, then back it up fast.",
  "Write like you're texting your closest friend a secret.",
  "Use rhetorical questions to pull the reader deeper.",
  "Be confident and direct — no hedging, no caveats, just you.",
] as const;

function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function computeVariationParams(
  creatorId: string,
  templateId: string
): VariationParams {
  const raw = djb2(`${creatorId}:${templateId}`);
  const seed = raw / 0xffffffff;
  return {
    styleDirective: STYLE_DIRECTIVES[raw % STYLE_DIRECTIVES.length],
    temperatureOffset: (seed - 0.5) * 0.3, // -0.15 to +0.15
    seed,
  };
}
