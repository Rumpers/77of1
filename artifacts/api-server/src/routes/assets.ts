// POST /api/onboarding/assets — creator asset upload with GMI content moderation gate.
// PHASE-1 STUB: asset_moderation_audit_log, creator_assets tables not in @workspace/db
// Restored in Phase 2 when creator asset tables are migrated to Drizzle.

import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { requireCreatorAuth } from "../middlewares/require-creator-auth.js";

const router: IRouter = Router();

// Multer config preserved for Phase 2 compatibility
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

// POST /api/onboarding/assets
router.post(
  "/onboarding/assets",
  requireCreatorAuth,
  upload.array("files", 28),
  async (_req: Request, res: Response) => {
    // PHASE-1 STUB: asset_moderation_audit_log, creator_assets not in Phase 1 schema — restored in Phase 2
    res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
  },
);

export default router;
