// PERSONA-02 constitution stub writer (D-02-13).
//
// Called from the persona wizard final step (plan 02-07). Composes a default
// markdown stub and uploads to `creators/{creatorId}/constitution.md` in
// Replit Object Storage. The api-server's readConstitution helper picks it
// up at chat time and prepends it to the system prompt.
//
// CONTRACT: this function NEVER throws into the wizard. Storage outages or
// missing bucket env produce a logged warning and a no-op return — the
// persona wizard must complete even if storage is down. The chat path
// degrades to "card-only persona" per T-02-02-07 in plan 02-02.
import { uploadObject } from "./object-storage.js";

function buildStub(creatorName: string): string {
  return (
    `# ${creatorName}'s constitution\n\n` +
    "(Tell me about your world, taboos, and the things only your closest fans " +
    "know. Edit this file directly on Replit Object Storage. Anything you write " +
    "here will be prepended to your twin's system prompt at chat time.)\n"
  );
}

export async function writeConstitutionStub(
  creatorId: string,
  creatorName: string,
): Promise<void> {
  const key = `creators/${creatorId}/constitution.md`;
  const stub = buildStub(creatorName);
  try {
    await uploadObject(key, stub, { contentType: "text/markdown" });
    console.log(
      `[hermes] constitution stub written creator_id=${creatorId} key=${key}`
    );
  } catch (err) {
    const msg = (err as Error).message;
    // Distinguish "no bucket configured" (expected when founder defers bucket
    // creation per D-02-13) from genuine outage.
    if (msg.includes("REPLIT_OBJECT_STORAGE_BUCKET")) {
      console.warn(
        `[hermes] constitution stub SKIPPED creator_id=${creatorId}: ${msg} — persona will run on Character Card V2 alone (graceful degrade)`
      );
    } else {
      console.error(
        `[hermes] constitution stub WRITE-FAILED creator_id=${creatorId}: ${msg} — persona scene continues; chat path will fall back to card-only persona`
      );
    }
    // Never re-throw. Wizard must complete.
  }
}
