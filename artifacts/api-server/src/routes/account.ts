// OF-172: Fan account recovery — POST /api/account/fan/recover
// PHASE-1 STUB: fan_accounts, fan_recovery_requests tables not in @workspace/db
// Restored in Phase 2 when fan account tables are migrated to Drizzle.

import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";

const router: IRouter = Router();

// Multer config preserved for Phase 2 compatibility
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// POST /api/account/fan/recover
router.post(
  "/account/fan/recover",
  upload.single("id_document"),
  async (_req: Request, res: Response) => {
    // PHASE-1 STUB: fan_accounts, fan_recovery_requests not in Phase 1 schema — restored in Phase 2
    res.status(503).json({ error: "Route depends on tables not in Phase 1 schema; restored in Phase 2", code: "PHASE_1_STUB" }); return;
  },
);

export default router;
