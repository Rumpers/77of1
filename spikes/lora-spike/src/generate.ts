/**
 * Step 2 — generate the eval gallery from the trained LoRA.
 *
 * Builds a grid: prompts × lora-strengths × seeds, plus a bleed/overfit check.
 * Downloads every image to outputs/gallery/ with the params encoded in the filename,
 * and writes outputs/gallery/manifest.json for the gallery view.
 *
 * Run:  pnpm generate   (after pnpm train)
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import Replicate from "replicate";
import { config } from "./config.ts";
import {
  GALLERY_DIR,
  TRAINING_RESULT,
  die,
  downloadTo,
  ensureDir,
  log,
  requireEnv,
  writeJson,
} from "./util.ts";

const token = requireEnv("REPLICATE_API_TOKEN");
const replicate = new Replicate({ auth: token });

interface TrainingResult {
  status: string;
  trainedVersion: string | null;
  destination: string;
}

interface GalleryItem {
  file: string;
  promptId: string;
  prompt: string;
  loraScale: number;
  seed: number;
  bleedCheck: boolean;
}

/** replicate.run output may be string URLs or FileOutput objects — normalize to URLs. */
function toUrls(output: unknown): string[] {
  const arr = Array.isArray(output) ? output : [output];
  return arr.map((o) => {
    if (typeof o === "string") return o;
    if (o && typeof (o as { url?: () => URL }).url === "function") return (o as { url: () => URL }).url().toString();
    if (o && typeof (o as { url?: string }).url === "string") return (o as { url: string }).url;
    throw new Error(`unexpected output item: ${JSON.stringify(o)}`);
  });
}

async function runOne(
  model: `${string}/${string}:${string}`,
  prompt: string,
  loraScale: number,
  seed: number,
): Promise<string> {
  const output = await replicate.run(model, {
    input: {
      prompt,
      lora_scale: loraScale,
      num_outputs: 1,
      aspect_ratio: config.generation.aspectRatio,
      num_inference_steps: config.generation.numInferenceSteps,
      guidance_scale: config.generation.guidanceScale,
      output_format: config.generation.outputFormat,
      seed,
    },
  });
  const [url] = toUrls(output);
  if (!url) throw new Error("no image url returned");
  return url;
}

async function main(): Promise<void> {
  const result = JSON.parse(await readFile(TRAINING_RESULT, "utf8")) as TrainingResult;
  if (result.status !== "succeeded" || !result.trainedVersion) {
    die("no successful trained version in outputs/training-result.json — run pnpm train first");
  }
  const model = result.trainedVersion as `${string}/${string}:${string}`;
  ensureDir(GALLERY_DIR);
  log(`generating gallery from ${model}`);

  const items: GalleryItem[] = [];
  const ext = config.generation.outputFormat;

  // Main grid: prompts × strengths × seeds
  for (const p of config.prompts) {
    const prompt = p.text.replace("{trigger}", config.triggerWord);
    for (const loraScale of config.generation.loraScales) {
      for (const seed of config.generation.seeds) {
        const file = `${p.id}__s${loraScale}__seed${seed}.${ext}`;
        try {
          const url = await runOne(model, prompt, loraScale, seed);
          await downloadTo(url, join(GALLERY_DIR, file));
          items.push({ file, promptId: p.id, prompt, loraScale, seed, bleedCheck: false });
          log(`  ✓ ${file}`);
        } catch (e) {
          log(`  ✗ ${file}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  // Bleed / overfit check: LoRA active, NO trigger word
  if (config.bleedCheck.enabled) {
    const file = `_BLEED_CHECK__s${config.bleedCheck.loraScale}__seed${config.bleedCheck.seed}.${ext}`;
    try {
      const url = await runOne(model, config.bleedCheck.prompt, config.bleedCheck.loraScale, config.bleedCheck.seed);
      await downloadTo(url, join(GALLERY_DIR, file));
      items.push({ file, promptId: "_bleed_check", prompt: config.bleedCheck.prompt, loraScale: config.bleedCheck.loraScale, seed: config.bleedCheck.seed, bleedCheck: true });
      log(`  ✓ ${file} (if this looks like the subject, the LoRA has overfit/bled)`);
    } catch (e) {
      log(`  ✗ bleed check: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const estCost = (items.length * 0.025).toFixed(2);
  await writeJson(join(GALLERY_DIR, "manifest.json"), {
    model,
    trigger: config.triggerWord,
    generatedCount: items.length,
    approxImageCostUsd: Number(estCost),
    loraScales: config.generation.loraScales,
    seeds: config.generation.seeds,
    items,
  });

  log(`✓ ${items.length} images in outputs/gallery/ (~$${estCost} inference)`);
  log(`Next: pnpm gallery  → builds gallery.html`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
