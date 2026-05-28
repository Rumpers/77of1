// HID-059: Asset content moderation for Hermes Telegram uploads.
// Inlined here (not imported from api-server) because Hermes is a separate process.
// Shared logic: same GMI vision API, same system prompt, same harm categories.

import { createHash } from "crypto";
import { db } from "@workspace/db";
import { safetyAuditLogTable } from "@workspace/db";

// ── types ─────────────────────────────────────────────────────────────────────

export interface AssetModerationResult {
  passed: boolean;
  flaggedCategories: string[];
  confidence: number;
  provider: "gmi" | "metadata_only";
  latencyMs: number;
  fileSha256: string;
}

// ── GMI vision moderator ───────────────────────────────────────────────────────

const HARM_CATEGORIES = [
  "csam",
  "minor_exploit",
  "non_consensual",
  "violence",
  "hate_imagery",
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

function getGmiConfig() {
  const baseUrl =
    process.env.GMI_API_BASE_URL ?? "https://api.gmi-serving.com/v1";
  const apiKey = process.env.GMI_API_KEY ?? "";
  const model = process.env.GMI_VISION_MODEL ?? "gpt-4o-mini";
  if (!apiKey) {
    throw new Error(
      "[asset-moderator] GMI_API_KEY not set — " +
        "escalate to CEO before bypassing moderation for Telegram uploads.",
    );
  }
  return { baseUrl, apiKey, model };
}

function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function parseClassification(
  raw: RawClassification,
  fileSha256: string,
  latencyMs: number,
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

  const passed =
    typeof raw.passed === "boolean"
      ? raw.passed && confidence < 0.5 && flaggedCategories.length === 0
      : confidence < 0.5 && flaggedCategories.length === 0;

  return {
    passed,
    flaggedCategories,
    confidence,
    provider: "gmi",
    latencyMs,
    fileSha256,
  };
}

// Moderate an image (photo bytes). Used for both photos and video thumbnails.
export async function moderateImageBytes(
  imageBytes: Buffer,
  mimeType: string,
): Promise<AssetModerationResult> {
  const { baseUrl, apiKey, model } = getGmiConfig();
  const fileSha256 = sha256(imageBytes);
  const dataUrl = `data:${mimeType};base64,${imageBytes.toString("base64")}`;

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
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
    throw new Error(`[asset-moderator] GMI API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as GmiVisionResponse;
  const raw = JSON.parse(
    data.choices[0]?.message?.content ?? "{}",
  ) as RawClassification;
  return parseClassification(raw, fileSha256, latencyMs);
}

// Moderate a video using its Telegram thumbnail.
// If thumbnailBytes is null: metadata-only pass (full frame extraction needs ffmpeg).
export async function moderateVideoWithThumbnail(
  thumbnailBytes: Buffer | null,
  videoBytes: Buffer,
): Promise<AssetModerationResult> {
  const fileSha256 = sha256(videoBytes);

  if (!thumbnailBytes) {
    console.warn(
      "[asset-moderator] no thumbnail for video — metadata-only pass " +
        "(full frame moderation requires ffmpeg, follow-up task pending)",
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

  const result = await moderateImageBytes(thumbnailBytes, "image/jpeg");
  return { ...result, fileSha256 };
}

// ── audit log write ────────────────────────────────────────────────────────────
//
// Writes to safetyAuditLogTable (D-14: retentionCategory='audit').
// asset_moderation_audit_log is not in the Phase 1 @workspace/db schema;
// asset moderation results are stored in the safety_audit_log table using
// hashed identifiers only (COMPLY-03: no raw fan_id or message text).
// The fileSha256 is used as both fanIdHash and messageHash since there is no
// fan identity involved in creator asset uploads.

export async function writeAssetModerationAudit(entry: {
  creatorId: string;
  assetId: string | null;
  assetType: "photo" | "video";
  channel: "web" | "telegram";
  result: AssetModerationResult;
}): Promise<void> {
  void (async () => {
    try {
      // Determine crisis level from flagged categories
      const crisisLevel = entry.result.passed
        ? ("none" as const)
        : entry.result.flaggedCategories.some((c) =>
              c === "csam" || c === "minor_exploit"
            )
          ? ("high" as const)
          : entry.result.flaggedCategories.some((c) =>
                c === "non_consensual"
              )
            ? ("medium" as const)
            : ("low" as const);

      await db.insert(safetyAuditLogTable).values({
        creatorId: entry.creatorId,
        // Use file sha256 as the hashed asset identifier (no raw fan_id in creator uploads)
        fanIdHash: createHash("sha256").update(entry.result.fileSha256).digest("hex"),
        sessionId: entry.assetId ?? entry.result.fileSha256,
        messageHash: entry.result.fileSha256,
        crisisLevel,
        crisisType: entry.result.flaggedCategories.join(",") || null,
        locale: "en",
        confidence: entry.result.confidence,
        responseSent: false,
        twinPaused: false,
        alerted: false,
        retentionCategory: "audit",
      });
    } catch (err) {
      console.error(
        `[asset-moderator] audit write exception: ${(err as Error).message}`,
      );
    }
  })();
}

// Insert an approved asset row into creator_assets.
// PHASE-1 STUB: creator_assets table not in @workspace/db — wired in Phase 2.
export async function insertApprovedAsset(entry: {
  creatorId: string;
  assetType: "photo" | "video";
  storagePath: string;
}): Promise<string | null> {
  // PHASE-1 STUB: creator_assets write deferred to Phase 2 — out of Phase 1 schema scope
  console.log(
    `[asset-moderator] STUB: creator_assets insert deferred to Phase 2 — creatorId=${entry.creatorId} assetType=${entry.assetType} storagePath=${entry.storagePath}`,
  );
  return null;
}
