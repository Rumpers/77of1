// POST /api/onboarding/assets — creator asset upload with GMI content moderation gate.
// HID-059: Every uploaded photo/video is moderated before being stored.
// Rejected files return 422 with per-file reasons; a moderation audit entry is written
// for every file regardless of outcome.

import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { requireCreatorAuth } from "../middlewares/require-creator-auth.js";
import { GmiAssetModerator, type AssetModerationResult } from "../providers/gmi/GmiAssetModerator.js";
import { getSupabase } from "../lib/supabase.js";

const router: IRouter = Router();

// Multer: memory storage so we can pass bytes to the moderator before storage.
// 100 MB per file matches the onboarding spec; 28 files max (25 photos + 3 videos).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 28 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
      "video/webm",
    ]);
    cb(null, allowed.has(file.mimetype));
  },
});

function getAssetType(mimeType: string): "photo" | "video" {
  return mimeType.startsWith("image/") ? "photo" : "video";
}

// Lazily create the moderator once per process so we throw early if GMI key is missing.
let _moderator: GmiAssetModerator | null = null;
function getModerator(): GmiAssetModerator {
  if (!_moderator) _moderator = new GmiAssetModerator();
  return _moderator;
}

async function writeAuditEntry(
  supabase: ReturnType<typeof getSupabase>,
  entry: {
    creatorId: string;
    assetId: string | null;
    assetType: "photo" | "video";
    channel: "web" | "telegram";
    result: AssetModerationResult;
  },
): Promise<void> {
  const { error } = await supabase.from("asset_moderation_audit_log").insert({
    creator_id: entry.creatorId,
    asset_id: entry.assetId,
    asset_type: entry.assetType,
    channel: entry.channel,
    provider: entry.result.provider,
    passed: entry.result.passed,
    flagged_categories: entry.result.flaggedCategories,
    confidence: entry.result.confidence,
    latency_ms: entry.result.latencyMs,
    file_sha256: entry.result.fileSha256,
  });
  if (error) {
    // Audit failure is a monitoring concern, not a user-facing error.
    console.error(
      `[assets] audit log write failed creator=${entry.creatorId}: ${error.message}`,
    );
  }
}

// POST /api/onboarding/assets
// Auth: Supabase creator session (cookie or Authorization header).
// Body: multipart/form-data with one or more files in field "files".
// Returns:
//   200 { ok: true, asset_ids: string[] } — all files passed moderation and were stored.
//   422 { ok: false, rejected: { filename, reason }[] } — one or more files blocked.
//   503 { ok: false, error: string } — DB not configured (expected in dev without Supabase).
router.post(
  "/onboarding/assets",
  requireCreatorAuth,
  upload.array("files"),
  async (req: Request, res: Response) => {
    const creatorId = res.locals.creatorId as string;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ ok: false, error: "No files received" });
      return;
    }

    let moderator: GmiAssetModerator;
    try {
      moderator = getModerator();
    } catch (err) {
      // GMI key missing — surface the error without silently bypassing moderation.
      console.error("[assets] moderator init failed:", (err as Error).message);
      res.status(503).json({
        ok: false,
        error:
          "Content moderation unavailable — GMI_API_KEY not configured. " +
          "Escalate to CEO before bypassing moderation gate.",
      });
      return;
    }

    // Moderate every file. Run in parallel; collect results.
    const moderationResults = await Promise.all(
      files.map(async (file) => {
        const assetType = getAssetType(file.mimetype);
        let result: AssetModerationResult;
        try {
          if (assetType === "photo") {
            result = await moderator.moderateImage(file.buffer, file.mimetype);
          } else {
            // Video: no client-side thumbnail in this flow, use metadata-only pass.
            // Telegram flow (see hermes) can supply a thumbnail.
            result = await moderator.moderateVideoThumbnail(null, file.buffer);
          }
        } catch (err) {
          // Moderation provider failure — fail closed (block the upload) and log.
          console.error(
            `[assets] moderation error file=${file.originalname}: ${(err as Error).message}`,
          );
          result = {
            passed: false,
            flaggedCategories: ["provider_error"],
            confidence: 1,
            provider: "gmi",
            latencyMs: 0,
            fileSha256: "",
          };
        }
        return { file, assetType, result };
      }),
    );

    const rejected = moderationResults.filter((r) => !r.result.passed);

    // Attempt DB operations regardless of outcome — auth is always present here.
    let supabase: ReturnType<typeof getSupabase> | null = null;
    try {
      supabase = getSupabase();
    } catch {
      // DB not configured (dev without Supabase). Write audit log to console.
      for (const { assetType, result, file } of moderationResults) {
        console.log(
          `[assets:audit] file=${file.originalname} type=${assetType} ` +
            `passed=${result.passed} confidence=${result.confidence.toFixed(2)} ` +
            `provider=${result.provider} categories=${result.flaggedCategories.join(",")}`,
        );
      }

      if (rejected.length > 0) {
        res.status(422).json({
          ok: false,
          rejected: rejected.map((r) => ({
            filename: r.file.originalname,
            reason: r.result.flaggedCategories.length
              ? `Content policy violation: ${r.result.flaggedCategories.join(", ")}`
              : "Content blocked by safety filter",
          })),
        });
        return;
      }

      // Dev stub: return fake IDs for passing files when DB is unavailable.
      res.json({
        ok: true,
        asset_ids: moderationResults
          .filter((r) => r.result.passed)
          .map(() => `stub-${crypto.randomUUID()}`),
      });
      return;
    }

    // Write audit entries for all files (pass and block) before returning.
    await Promise.all(
      moderationResults.map(({ assetType, result, file }) =>
        writeAuditEntry(supabase!, {
          creatorId,
          assetId: null, // filled in below after insert for approved files
          assetType,
          channel: "web",
          result,
        }).catch((err) =>
          console.error(
            `[assets] audit write failed file=${file.originalname}: ${(err as Error).message}`,
          ),
        ),
      ),
    );

    if (rejected.length > 0) {
      console.warn(
        `[assets] moderation blocked ${rejected.length}/${files.length} files creator=${creatorId}`,
      );
      res.status(422).json({
        ok: false,
        rejected: rejected.map((r) => ({
          filename: r.file.originalname,
          reason: r.result.flaggedCategories.length
            ? `Content policy violation: ${r.result.flaggedCategories.join(", ")}`
            : "Content blocked by safety filter",
        })),
      });
      return;
    }

    // All files passed — insert creator_assets rows.
    const insertedIds: string[] = [];
    for (const { file, assetType, result } of moderationResults) {
      // storage_path is a placeholder until Replit object storage is wired.
      // The path convention is: creators/{creatorId}/assets/{sha256}{ext}
      const ext = file.originalname.split(".").pop() ?? "";
      const storagePath = `creators/${creatorId}/assets/${result.fileSha256}.${ext}`;

      const { data: asset, error } = await supabase
        .from("creator_assets")
        .insert({
          creator_id: creatorId,
          asset_type: assetType,
          storage_path: storagePath,
          consent_status: "pending",
          moderation_status: "approved",
        })
        .select("id")
        .single();

      if (error || !asset) {
        console.error(`[assets] creator_assets insert error: ${error?.message}`);
        // Continue inserting other files; partial failure is reported below.
        continue;
      }

      insertedIds.push(asset.id as string);

      // Update audit entry with the now-known asset_id.
      await supabase
        .from("asset_moderation_audit_log")
        .update({ asset_id: asset.id })
        .eq("creator_id", creatorId)
        .eq("file_sha256", result.fileSha256)
        .is("asset_id", null);
    }

    console.log(
      `[assets] stored ${insertedIds.length}/${files.length} assets creator=${creatorId}`,
    );

    res.json({ ok: true, asset_ids: insertedIds });
  },
);

export default router;
