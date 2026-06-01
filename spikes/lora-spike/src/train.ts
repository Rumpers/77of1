/**
 * Step 1 — train a FLUX.1 LoRA on the subject's photos via Replicate.
 *
 * Flow: gather photos → zip → ensure destination model → start training →
 * poll to completion → write outputs/training-result.json.
 *
 * Run:  pnpm train
 */
import "dotenv/config";
import { openAsBlob } from "node:fs";
import { join } from "node:path";
import Replicate from "replicate";
import { config } from "./config.ts";
import {
  OUTPUTS_DIR,
  SPIKE_ROOT,
  TRAINING_RESULT,
  die,
  ensureDir,
  listImages,
  log,
  requireEnv,
  sleep,
  writeJson,
  zipFiles,
} from "./util.ts";

const token = requireEnv("REPLICATE_API_TOKEN");
const owner = requireEnv("REPLICATE_OWNER");
const replicate = new Replicate({ auth: token });

const destination = `${owner}/${config.destModelName}` as const;

async function ensureDestinationModel(): Promise<void> {
  try {
    await replicate.models.get(owner, config.destModelName);
    log(`destination model exists: ${destination}`);
  } catch {
    log(`creating destination model: ${destination}`);
    await replicate.models.create(owner, config.destModelName, {
      visibility: "private",
      hardware: "gpu-t4", // placeholder hardware; inference hardware is chosen by the model at run time
      description: "THROWAWAY LoRA spike — founder-internal likeness test.",
    });
  }
}

async function resolveTrainerVersion(): Promise<string> {
  const [tOwner, tName] = config.training.trainerModel.split("/");
  const model = await replicate.models.get(tOwner, tName);
  const version = model.latest_version?.id;
  if (!version) die(`could not resolve latest version of ${config.training.trainerModel}`);
  log(`trainer ${config.training.trainerModel} @ ${version.slice(0, 12)}…`);
  return version;
}

async function main(): Promise<void> {
  ensureDir(OUTPUTS_DIR);

  // 1. Gather + zip photos
  const photos = listImages(join(SPIKE_ROOT, config.photosDir));
  if (photos.length < 8) die(`only ${photos.length} usable images found — need ~20-30 for a meaningful test`);
  log(`zipping ${photos.length} images…`);
  const zipPath = join(OUTPUTS_DIR, "dataset.zip");
  await zipFiles(photos, zipPath);

  // 2. Destination model + trainer version
  await ensureDestinationModel();
  const trainerVersion = await resolveTrainerVersion();

  // 3. Start training (SDK auto-uploads the Blob)
  log(`starting training: ${config.training.steps} steps, rank ${config.training.loraRank}, trigger "${config.triggerWord}"`);
  const inputZip = await openAsBlob(zipPath);
  const [tOwner, tName] = config.training.trainerModel.split("/");
  let training = await replicate.trainings.create(tOwner, tName, trainerVersion, {
    destination,
    input: {
      input_images: inputZip,
      trigger_word: config.triggerWord,
      steps: config.training.steps,
      lora_rank: config.training.loraRank,
      learning_rate: config.training.learningRate,
      autocaption: config.training.autocaption,
      resolution: config.training.resolution,
    },
  });
  log(`training ${training.id} → ${training.urls?.get ?? "(no url)"}`);
  log(`watch live: https://replicate.com/p/${training.id}`);

  // 4. Poll
  const started = Date.now();
  while (training.status !== "succeeded" && training.status !== "failed" && training.status !== "canceled") {
    await sleep(10_000);
    training = await replicate.trainings.get(training.id);
    const mins = ((Date.now() - started) / 60_000).toFixed(1);
    log(`status: ${training.status} (${mins} min)`);
  }

  if (training.status !== "succeeded") {
    await writeJson(TRAINING_RESULT, { status: training.status, error: training.error ?? null, id: training.id });
    die(`training ${training.status}: ${String(training.error ?? "unknown")}`);
  }

  // 5. Record result. ostris trainer output: { version: "owner/name:hash", weights: "url" }
  const output = training.output as { version?: string; weights?: string } | null;
  const trainedVersion = output?.version ?? null;
  await writeJson(TRAINING_RESULT, {
    status: "succeeded",
    trainingId: training.id,
    destination,
    trainedVersion, // pass this to generate.ts
    weightsUrl: output?.weights ?? null,
    trigger: config.triggerWord,
    steps: config.training.steps,
    loraRank: config.training.loraRank,
    durationMin: Number(((Date.now() - started) / 60_000).toFixed(1)),
  });

  log(`✓ training done. trained version: ${trainedVersion ?? "(check Replicate dashboard)"}`);
  log(`Result written to outputs/training-result.json`);
  log(``);
  log(`DATA-MINIMIZATION (TRAIN-03): the uploaded dataset still lives on Replicate.`);
  log(`Delete it from https://replicate.com/account once you've confirmed the trained model exists.`);
  log(`Next: pnpm generate`);
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
