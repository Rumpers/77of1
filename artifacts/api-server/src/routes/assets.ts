import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "crypto";

const router: IRouter = Router();

// POST /api/onboarding/assets
// Body: multipart/form-data with files
// Returns: { ok: true, asset_ids: string[] }
// Slice 1 stub — acknowledges receipt, no actual storage
router.post("/onboarding/assets", (req: Request, res: Response) => {
  // In Slice 1 there is no DB or object storage configured.
  // We accept the request and return stub asset IDs so the client can proceed.
  // When storage is wired, this handler will parse the multipart body,
  // upload to object storage, and insert rows into creator_assets.

  // Generate deterministic-ish stub IDs based on current time
  const stubCount = 1; // minimum acknowledgement
  const asset_ids = Array.from({ length: stubCount }, () =>
    `stub-${crypto.randomUUID()}`
  );

  res.json({ ok: true, asset_ids });
});

export default router;
