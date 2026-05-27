// GMI-first image content moderator for creator asset uploads (HID-059).
// Uses GMI vision API (OpenAI-compatible) to classify photos before storage.
// Video moderation: uses thumbnail bytes if available; falls back to metadata-only
// pass when no thumbnail is provided (full frame extraction needs ffmpeg — follow-up).
// Never silently falls back to another provider — escalate to CEO if GMI is unavailable.

import { createHash } from "crypto";

export interface AssetModerationResult {
  passed: boolean;
  flaggedCategories: string[];
  confidence: number;
  provider: "gmi" | "metadata_only";
  latencyMs: number;
  fileSha256: string;
}

// Categories the classifier may flag. Kept tight — platform allows adult content
// from consenting creators, so only genuinely harmful content is blocked.
const HARM_CATEGORIES = [
  "csam",           // child sexual abuse material — always blocked, confidence 1.0
  "minor_exploit",  // minors in sexual or exploitative contexts
  "non_consensual", // non-consensual intimate imagery
  "violence",       // graphic violence or gore
  "hate_imagery",   // hate symbols / extremist imagery
] as const;

const SYSTEM_PROMPT = `You are a content safety classifier for a creator-fan platform.
Given an image, assess whether it is safe to store as a creator asset.
Respond ONLY with valid JSON in this exact format (no other text):
{"passed":true,"flaggedCategories":[],"confidence":0.0}

Flag (passed=false) by category and minimum confidence:
- CSAM (child sexual abuse material): confidence 1.0, categories: ["csam"]
- Minors in sexual or exploitative contexts: confidence 1.0, categories: ["minor_exploit"]
- Non-consensual intimate imagery: confidence 0.9, categories: ["non_consensual"]
- Graphic violence or gore: confidence 0.8, categories: ["violence"]
- Hate symbols or extremist imagery: confidence 0.7, categories: ["hate_imagery"]

Always permitted (passed=true, confidence < 0.5):
- Adult creator selfies, portraits, body photos
- Tasteful or artistic nudity from clearly adult subjects
- General lifestyle, travel, food, fashion content
- Explicit adult content clearly between consenting adults

passed must be true ONLY if confidence < 0.5 AND flaggedCategories is empty.`;

interface GmiVisionResponse {
  choices: Array<{ message: { content: string } }>;
}

interface RawClassification {
  passed?: unknown;
  flaggedCategories?: unknown;
  confidence?: unknown;
}

export class GmiAssetModerator {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(opts?: { baseUrl?: string; apiKey?: string; model?: string }) {
    this.baseUrl =
      opts?.baseUrl ??
      process.env["GMI_API_BASE_URL"] ??
      "https://api.gmi-serving.com/v1";
    this.apiKey = opts?.apiKey ?? process.env["GMI_API_KEY"] ?? "";
    if (!this.apiKey) {
      throw new Error(
        "[asset-moderator] GMI_API_KEY not set — " +
          "GMI capability gap, escalate to CEO before switching to a fallback provider.",
      );
    }
    this.model =
      opts?.model ?? process.env["GMI_VISION_MODEL"] ?? "gpt-4o-mini";
  }

  // Moderate a photo. imageBytes must be the raw file bytes (jpg/png/webp).
  async moderateImage(
    imageBytes: Buffer,
    mimeType: string,
  ): Promise<AssetModerationResult> {
    const fileSha256 = sha256(imageBytes);
    const dataUrl = `data:${mimeType};base64,${imageBytes.toString("base64")}`;

    const t0 = Date.now();
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: "json_object" },
          temperature: 0,
          max_tokens: 128,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: dataUrl, detail: "low" },
                },
                {
                  type: "text",
                  text: "Classify this image for content safety.",
                },
              ],
            },
          ],
        }),
      });
    } catch (err) {
      throw new Error(
        `[asset-moderator] GMI network error: ${(err as Error).message}`,
      );
    }
    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `[asset-moderator] GMI API error ${res.status}: ${body}`,
      );
    }

    const data = (await res.json()) as GmiVisionResponse;
    const raw = JSON.parse(
      data.choices[0]?.message?.content ?? "{}",
    ) as RawClassification;

    return this.buildResult(raw, fileSha256, latencyMs, "gmi");
  }

  // Moderate a video via its thumbnail.
  // thumbnailBytes: JPEG thumbnail extracted by Telegram or client; null if unavailable.
  // When null, returns a metadata-only pass — full frame extraction requires ffmpeg.
  async moderateVideoThumbnail(
    thumbnailBytes: Buffer | null,
    videoBytes: Buffer,
  ): Promise<AssetModerationResult> {
    const fileSha256 = sha256(videoBytes);

    if (!thumbnailBytes) {
      // Metadata-only pass: file type and size already validated by route layer.
      // Full per-frame video moderation via ffmpeg is a follow-up task.
      console.warn(
        "[asset-moderator] video thumbnail not available — " +
          "using metadata-only pass (frame moderation requires ffmpeg)",
      );
      return {
        passed: true,
        flaggedCategories: [],
        confidence: 0,
        provider: "metadata_only",
        latencyMs: 0,
        fileSha256,
      };
    }

    const result = await this.moderateImage(thumbnailBytes, "image/jpeg");
    return { ...result, fileSha256 };
  }

  private buildResult(
    raw: RawClassification,
    fileSha256: string,
    latencyMs: number,
    provider: "gmi",
  ): AssetModerationResult {
    const confidence =
      typeof raw.confidence === "number"
        ? Math.max(0, Math.min(1, raw.confidence))
        : 0.5;

    const flaggedCategories = Array.isArray(raw.flaggedCategories)
      ? (raw.flaggedCategories as string[]).filter((c) =>
          (HARM_CATEGORIES as readonly string[]).includes(c),
        )
      : [];

    // Re-derive passed from fields to guard against LLM inconsistency.
    const passed =
      typeof raw.passed === "boolean"
        ? raw.passed && confidence < 0.5 && flaggedCategories.length === 0
        : confidence < 0.5 && flaggedCategories.length === 0;

    return { passed, flaggedCategories, confidence, provider, latencyMs, fileSha256 };
  }
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}
