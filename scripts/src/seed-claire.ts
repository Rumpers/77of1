// seed-claire.ts — Idempotent upsert of Claire's creator + twin records.
//
// Usage:
//   pnpm tsx scripts/src/seed-claire.ts
//
// Env overrides (optional):
//   CLAIRE_HANDLE              default: "claire"
//   CLAIRE_MONETIZATION_URL    default: "https://17.live/en-US/profile/claire"
//   DATABASE_URL               required (injected by Replit)
//
// After running:
//   1. Note the printed creator_id
//   2. Set EVAL_CREATOR_ID=<that id>
//   3. Run the eval harness: pnpm --filter @workspace/eval run eval
//   4. When eval passes: POST /api/admin/twin/:creatorId/activate
//
// This seed is a founder-approved deviation from the full Hermes onboarding flow.
// It is a DISPOSABLE TEST FIXTURE — Claire must complete proper Hermes onboarding
// (with voice, photos, and SignWell) before going live.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lazy DB import — same pattern as eval/db-helpers.ts (lib/eval/src/db-helpers.ts).
// This keeps the module loadable in environments that check for DATABASE_URL at
// import time, and matches the project's PATTERNS S1 lazy import convention.
async function getDb() {
  const mod = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  return { ...mod, eq };
}

const CLAIRE_HANDLE = process.env.CLAIRE_HANDLE ?? "claire";
const CLAIRE_MONETIZATION_URL =
  process.env.CLAIRE_MONETIZATION_URL ?? "https://17.live/en-US/profile/claire";

async function main(): Promise<void> {
  const {
    db,
    creatorsTable,
    creatorKycTable,
    creatorConfigTable,
    twinsTable,
    personasTable,
    characterCardV2Schema,
    eq,
  } = await getDb();

  // ── Load + validate the Character Card ──────────────────────────────────────
  const cardPath = join(__dirname, "../../personas/claire.json");
  const cardRaw = JSON.parse(readFileSync(cardPath, "utf-8")) as unknown;
  const cardParsed = characterCardV2Schema.safeParse(cardRaw);
  if (!cardParsed.success) {
    console.error("claire.json failed Character Card V2 validation:");
    console.error(cardParsed.error.issues);
    process.exit(1);
  }
  const characterCard = cardParsed.data;
  console.log(`[seed-claire] Character Card validated OK (name: ${characterCard.data.name})`);

  // ── Upsert creators row ──────────────────────────────────────────────────────
  const [creator] = await db
    .insert(creatorsTable)
    .values({
      handle: CLAIRE_HANDLE,
      displayName: "Claire",
      config: {
        platform_name: "17LIVE",
        platform_url: CLAIRE_MONETIZATION_URL,
        locale_default: "zh-TW",
        brand_color: "#ff6b9d",
      },
      monetizationUrl: CLAIRE_MONETIZATION_URL,
      killSwitchActive: false,
    })
    .onConflictDoUpdate({
      target: creatorsTable.handle,
      set: {
        displayName: "Claire",
        monetizationUrl: CLAIRE_MONETIZATION_URL,
        config: {
          platform_name: "17LIVE",
          platform_url: CLAIRE_MONETIZATION_URL,
          locale_default: "zh-TW",
          brand_color: "#ff6b9d",
        },
        updatedAt: new Date(),
      },
    })
    .returning({ id: creatorsTable.id });

  const creatorId = creator?.id;
  if (!creatorId) {
    console.error("[seed-claire] failed to upsert creator row");
    process.exit(1);
  }
  console.log(`[seed-claire] creator.id = ${creatorId}`);

  // ── Upsert creator_kyc row (status=signed, voiceSynthesisConsentGranted=true) ─
  await db
    .insert(creatorKycTable)
    .values({
      creatorId,
      status: "signed",
      voiceSynthesisConsentGranted: true,
    })
    .onConflictDoUpdate({
      target: creatorKycTable.creatorId,
      set: {
        status: "signed",
        voiceSynthesisConsentGranted: true,
        updatedAt: new Date(),
      },
    });
  console.log("[seed-claire] creator_kyc upserted (status=signed)");

  // ── Upsert creator_config row (paused=false) ─────────────────────────────────
  await db
    .insert(creatorConfigTable)
    .values({
      creatorId,
      paused: false,
      timezone: "Asia/Taipei",
      hermesLanguage: "zh-TW",
    })
    .onConflictDoUpdate({
      target: creatorConfigTable.creatorId,
      set: {
        paused: false,
        timezone: "Asia/Taipei",
        hermesLanguage: "zh-TW",
        updatedAt: new Date(),
      },
    });
  console.log("[seed-claire] creator_config upserted (paused=false)");

  // ── Upsert twins row ──────────────────────────────────────────────────────────
  // status = "inactive" — twin must pass eval gate before activation.
  // direction = null — founder can set via DB or admin panel once eval passes.
  await db
    .insert(twinsTable)
    .values({
      creatorId,
      handle: CLAIRE_HANDLE,
      status: "inactive",
      visibility: "private",
      characterCard: characterCard as unknown as Record<string, unknown>,
      voiceReferenceUrl: null,
      voiceId: null,
      direction: null,
    })
    .onConflictDoUpdate({
      target: twinsTable.handle,
      set: {
        characterCard: characterCard as unknown as Record<string, unknown>,
        status: "inactive",
        updatedAt: new Date(),
      },
    });
  console.log(`[seed-claire] twins upserted (handle=${CLAIRE_HANDLE}, status=inactive)`);

  // ── Upsert personas row ───────────────────────────────────────────────────────
  // Baseline persona style derived from the character card.
  const existingPersona = await db
    .select({ id: personasTable.id })
    .from(personasTable)
    .where(eq(personasTable.creatorId, creatorId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (!existingPersona) {
    await db.insert(personasTable).values({
      creatorId,
      greetingStyle: "warm and curious, asks a follow-up question",
      fanEndearment: "you",
      emojiUsage: "minimal",
      hardStops: ["CSAM", "self-harm encouragement", "illegal activity"],
      treatmentStyle: "friendly peer, not celebrity-distant",
      personalityTraits: ["warm", "playful", "encouraging", "genuine"],
      messageStyle: "short paragraphs, conversational, occasional emoji",
      intensityLevel: "warm",
    });
    console.log("[seed-claire] personas row inserted");
  } else {
    console.log(`[seed-claire] personas row already exists (id=${existingPersona.id}) — skipping`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log("");
  console.log("=".repeat(60));
  console.log("Seed complete. Next steps:");
  console.log(`  1. Set:  export EVAL_CREATOR_ID=${creatorId}`);
  console.log("  2. Run:  pnpm --filter @workspace/eval run eval");
  console.log("  3. When eval passes (100% hard-limit + injection):");
  console.log(`           POST /api/admin/twin/${creatorId}/activate`);
  console.log("=".repeat(60));
}

main().catch((err) => {
  console.error("[seed-claire] fatal:", err);
  process.exit(1);
});
