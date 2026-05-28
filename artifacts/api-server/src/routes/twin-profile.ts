// GET /api/twin/:handle/profile — public-read CTA data for the fan SPA
// (CHAT-05, D-02-10).
//
// Returns:
//   {
//     handle,             // creator.handle
//     brand_color,        // creator.config.brand_color ?? "#7c3aed"
//     monetization_url,   // creator.monetization_url (may be null)
//     platform_name,      // creator.config.platform_name ?? "the platform"
//     locale_default      // creator.config.locale_default ?? "en"
//   }
//
// 404 when the handle does not resolve to a creator. No KYC gate, no HMAC
// gate — this is the data the web SPA needs BEFORE the fan starts chatting
// (used to render the avatar tile, brand color, and the "Find me on X" CTA).
//
// monetization_url and config.platform_name are both populated by the
// persona wizard final step in plan 02-07. Until then, the defaults below
// keep the SPA functional (CTA hides when monetization_url is null).
import { Router, type IRouter, type Request, type Response } from "express";

// Lazy DB import (PATTERNS S1) — keeps unit tests runnable without DATABASE_URL.
async function getDb() {
  const { db, creatorsTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  return { db, creatorsTable, eq };
}

const router: IRouter = Router();

interface CreatorConfig {
  brand_color?: string;
  platform_name?: string;
  locale_default?: string;
}

router.get("/twin/:handle/profile", async (req: Request, res: Response) => {
  const handle = req.params.handle;
  if (!handle || typeof handle !== "string" || handle.trim().length === 0) {
    res.status(400).json({ error: "handle is required" });
    return;
  }

  let db: Awaited<ReturnType<typeof getDb>>["db"];
  let creatorsTable: Awaited<ReturnType<typeof getDb>>["creatorsTable"];
  let eq: Awaited<ReturnType<typeof getDb>>["eq"];
  try {
    ({ db, creatorsTable, eq } = await getDb());
  } catch {
    res.status(503).json({ error: "Database not configured" });
    return;
  }

  const creator = await db
    .select({
      handle: creatorsTable.handle,
      monetizationUrl: creatorsTable.monetizationUrl,
      config: creatorsTable.config,
    })
    .from(creatorsTable)
    .where(eq(creatorsTable.handle, handle))
    .limit(1)
    .then(
      (
        r: Array<{
          handle: string;
          monetizationUrl: string | null;
          config: CreatorConfig | null;
        }>,
      ) => r[0] ?? null,
    );

  if (!creator) {
    res.status(404).json({ error: "Creator not found" });
    return;
  }

  const cfg = (creator.config ?? {}) as CreatorConfig;
  res.json({
    handle: creator.handle,
    brand_color: cfg.brand_color ?? "#7c3aed",
    monetization_url: creator.monetizationUrl ?? null,
    platform_name: cfg.platform_name ?? "the platform",
    locale_default: cfg.locale_default ?? "en",
  });
});

export default router;
