# Architecture Research

**Domain:** Image-gen + LoRA R&D spike inside a no-GPU Replit monorepo
**Researched:** 2026-06-01
**Confidence:** HIGH (provider APIs verified via official docs; monorepo patterns from direct codebase read)

---

## 1. Where the Spike Code Should Live

### Recommendation: a throwaway CLI script in `spikes/lora-spike/`

Put the spike under a top-level `spikes/` directory (not under `artifacts/` or `lib/`). This keeps it completely outside the pnpm workspace graph and outside Replit's artifact system. It will never appear in `pnpm run build`, never be deployed, and can be deleted when the spike is done.

```
spikes/
└── lora-spike/
    ├── package.json          # standalone, not a workspace member
    ├── tsconfig.json         # extends ../../tsconfig.base.json
    ├── .env.local            # IMAGE_PROVIDER key, never committed
    ├── src/
    │   ├── upload.ts         # zip + upload source photos to provider
    │   ├── train.ts          # kick off LoRA training job, poll to completion
    │   ├── generate.ts       # run N generation prompts, save outputs
    │   └── gallery.ts        # dump a manifest JSON + local image folder
    └── outputs/              # gitignored; generated images land here
```

This is a `tsx`-run CLI (already in the workspace catalog at `^4.21.0`), not a long-running server. No Express, no BullMQ, no Replit port constraints.

### What to NOT build in the spike

Do NOT create a `lib/providers` `IImageProvider` interface yet. Do NOT add a BullMQ queue. Do NOT wire into `artifacts/worker`. These are the production seam — build them only after the spike returns a go/no-go verdict.

### The production seam (note it, do not build it yet)

When this spike ships and the result is "go", the production integration path is:

1. Add `IImageProvider` to `lib/providers/src/providers/interfaces.ts` — mirrors `IVoiceProvider` exactly: `enqueueImageGeneration()` returns `{ providerJobId }`, `getJobStatus()` returns `{ status, imageUrl }`.
2. Add `MockImageProvider` to `lib/providers/src/providers/mocks.ts`.
3. Add `image` slot to `ProviderRegistry` and `createRegistry` in `registry.ts`.
4. Add a `lora-training` BullMQ queue definition to `lib/queue`.
5. Add an `image-gen` BullMQ queue definition to `lib/queue`.
6. Implement both in `artifacts/worker` — following the exact pattern of voice async jobs.
7. Expose routes in `artifacts/api-server` behind the existing entitlement middleware.

The spike is explicitly designed so that `train.ts` and `generate.ts` become the first draft of the two concrete provider methods above.

---

## 2. Data Flow for the Spike

```
Local disk: source photos (JPEGs, ~10-30 images)
    │
    ├── [upload.ts]
    │   Zip the photos directory → upload zip to chosen provider's storage
    │   OR upload to Replit Object Storage → get a signed URL
    │   → training_images_url (public or pre-signed URL for provider to fetch)
    │
    ├── [train.ts]
    │   POST training job to provider API (Replicate or fal.ai)
    │   → returns training_job_id
    │   Poll every 10–30 s until status = "succeeded" | "failed"
    │   → log output.weights URL (Replicate: stored on their CDN)
    │   OR output.diffusers_lora_file URL (fal.ai: S3-backed temp URL)
    │   → write weights URL to outputs/training-result.json (local)
    │   Optionally: download .safetensors to outputs/weights/ for archival
    │
    ├── [generate.ts]
    │   Read weights URL from outputs/training-result.json
    │   POST N generation requests, each with:
    │     - base model: FLUX.1-dev or FLUX.1-schnell
    │     - lora_url: weights URL
    │     - prompt: list of founder-chosen evaluation prompts
    │   Poll each prediction to completion
    │   → download output images to outputs/gallery/
    │
    └── [gallery.ts]
        Write outputs/gallery/manifest.json with
        { prompt, imageUrl, localFile, trainingJobId, generationJobId }
        → founder reviews locally / shares via Replit Object Storage
```

### Storage decisions for the spike

| Asset | Spike storage | Why |
|-------|---------------|-----|
| Source photos (input) | Local disk in `spikes/lora-spike/data/photos/` (gitignored) | Simplest; no upload step until `train.ts` zips them |
| Zip for provider upload | Local temp file, deleted after upload | Provider pulls it once |
| LoRA weights | Provider-hosted CDN URL (Replicate or fal.ai stores them) | No manual S3 setup; URL is the artifact |
| Generated images | Downloaded to `outputs/gallery/` local disk | Founder reviews on the machine; no Object Storage plumbing needed |
| Manifest JSON | `outputs/gallery/manifest.json` | Human-readable go/no-go record |

**No Replit Object Storage in the spike.** The production system will use Replit Object Storage under `creators/{creator_id}/lora_weights/{version}.safetensors` and `creators/{creator_id}/generated/{image_id}.jpg`, mirroring the existing `creators/{creator_id}/voice_reference.wav` pattern. For the spike, local disk and provider-hosted URLs are sufficient.

---

## 3. Async / Job Shape

### Spike: simple polling script — correct, no BullMQ needed

LoRA training takes 20–40 minutes on Replicate (FLUX.1-dev, ~1000 steps, under $2). fal.ai's portrait trainer is faster — reported 10x, so potentially 3–8 minutes. Neither is realtime. A `while (status !== 'succeeded')` polling loop with a `setTimeout`-based sleep in a `tsx` CLI is perfectly appropriate here. The script just runs in a terminal and the founder walks away.

```typescript
// train.ts — spike polling loop (simplified)
async function pollUntilDone(trainingId: string): Promise<TrainingOutput> {
  while (true) {
    const result = await getTrainingStatus(trainingId);
    if (result.status === 'succeeded') return result.output;
    if (result.status === 'failed') throw new Error(`Training failed: ${result.error}`);
    console.log(`[${new Date().toISOString()}] status=${result.status}, polling in 30s...`);
    await sleep(30_000);
  }
}
```

Generation jobs are 5–30 seconds each. Same polling pattern, shorter interval (3 s).

### Production: BullMQ + worker, mirrors voice pattern exactly

When productionized, map onto the existing pattern:

| Voice job (existing) | Image job (future) |
|---------------------|-------------------|
| `lib/queue` — `voiceQueue` | `lib/queue` — `loraTrainingQueue`, `imageGenQueue` |
| `IVoiceProvider.enqueueVoiceGeneration()` | `IImageProvider.enqueueImageGeneration()` |
| `IVoiceProvider.getJobStatus()` | `IImageProvider.getJobStatus()` |
| `artifacts/worker` polls GMI XTTS job | `artifacts/worker` polls Replicate/fal.ai job |
| Result URL stored in DB via Drizzle | Result URL stored in DB via Drizzle |

Training is different from generation — it is a one-time operational job (run once per creator per LoRA version), not a fan-triggered job. In production it should be a separate queue (`loraTrainingQueue`) kicked off by the admin panel or Hermes, not by fan chat. Generation (`imageGenQueue`) is fan-triggered and maps directly to voice's existing pattern.

---

## 4. Component Map: New vs Modified vs Spike-Only

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SPIKE-ONLY (throwaway, not in workspace graph)                              │
│                                                                              │
│  spikes/lora-spike/src/                                                      │
│    upload.ts      — zip photos, upload to provider                          │
│    train.ts       — kick training job, poll, save weights URL               │
│    generate.ts    — run generation prompts, poll, download images           │
│    gallery.ts     — write manifest JSON for founder review                  │
│                                                                              │
│  External provider (new account, no codebase change):                       │
│    Replicate or fal.ai  (see provider recommendation below)                 │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ spike findings inform
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PRODUCTION SEAM (build AFTER spike go verdict)                              │
│                                                                              │
│  lib/providers/src/providers/interfaces.ts  [MODIFIED]                      │
│    + IImageProvider, ImageGenerationInput, ImageGenerationResult,           │
│      ImageJobStatus interfaces                                               │
│                                                                              │
│  lib/providers/src/providers/mocks.ts  [MODIFIED]                           │
│    + MockImageProvider                                                       │
│                                                                              │
│  lib/providers/src/providers/registry.ts  [MODIFIED]                        │
│    + image slot in ProviderRegistry, buildImageProvider()                   │
│                                                                              │
│  lib/providers/src/providers/replicate-image.ts  [NEW]  (or fal-image.ts)  │
│    concrete IImageProvider impl                                              │
│                                                                              │
│  lib/queue/src/queues.ts  [MODIFIED]                                        │
│    + loraTrainingQueue, imageGenQueue definitions                           │
│                                                                              │
│  artifacts/worker/src/handlers/  [MODIFIED]                                 │
│    + lora-training.handler.ts — admin/Hermes triggered, long-running        │
│    + image-gen.handler.ts     — fan triggered, short-running                │
│                                                                              │
│  lib/db/src/migrations/016_lora_assets.sql  [NEW]                          │
│    lora_versions, generated_images tables                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Nothing in the existing production system changes during the spike.** `lib/twin-runtime`, `artifacts/api-server`, `artifacts/hermes`, `artifacts/fan-twin` are untouched.

---

## 5. Provider Recommendation: Replicate for the Spike

**Use Replicate.** Reasons specific to this spike:

- **Official Node.js SDK** (`replicate` npm package, TypeScript types included). fal.ai has `@fal-ai/client` which is also fine, but Replicate's SDK is more mature and better documented for training.
- **Training storage is automatic.** After a FLUX.1-dev LoRA training completes, Replicate publishes the model version and stores weights on their CDN. The spike just reads `output.weights` from the training result — no S3 credentials, no manual download required for inference.
- **Cost is low enough for a spike.** ~$2 per training run at 1000 steps, under 30 minutes. Acceptable for R&D.
- **Inference uses the same model handle.** `replicate.run("username/model-name:version", { input: { prompt, lora_scale } })` — the training and generation scripts share the same model reference.

**fal.ai is the production-ready alternative** and should be seriously considered when productionizing. fal.ai's portrait-specific trainer (`fal-ai/flux-lora-portrait-trainer`) is tuned for face/person LoRAs (includes segmentation masking, per-face captioning). Its queue API (`fal.queue.submit` / `fal.queue.status` / `fal.queue.result`) maps cleanly onto the BullMQ worker pattern. If the spike result is "go", evaluate switching to fal.ai for the production provider.

---

## 6. Build Order: Fastest Path to a First Generated Image

This is the strictly sequential dependency chain:

1. **Get provider credentials** — Create Replicate account, generate `REPLICATE_API_TOKEN`, store in `.env.local`. (5 min)

2. **Prep training photos** — Collect 10–20 photos of Claire (already have them per memory context). Resize to ~1024px shortest side. Write to `spikes/lora-spike/data/photos/`. (30 min, founder task)

3. **Write `upload.ts`** — Zip the photos directory, upload the zip via `replicate.deployments.predictions.create` or just use the Replicate web UI to pre-upload and get a URL. For the spike, the web UI upload is acceptable — `upload.ts` just documents the URL. (30 min to code, or 5 min manual upload)

4. **Write `train.ts`** — POST to Replicate's fine-tune endpoint using the zip URL and a trigger word (e.g., `CLAIR3`). Poll every 30 s. Log the resulting model version handle. Save to `outputs/training-result.json`. (1-2 hours of wall time while training runs; ~1 hour of coding)

5. **Write `generate.ts`** — Load the model handle from `outputs/training-result.json`. Run 10–15 generation prompts covering different styles, poses, moods. Poll each to completion. Download images. (30 min to code, 10–30 min to run)

6. **Write `gallery.ts`** — Write `outputs/gallery/manifest.json`. Done. Founder reviews images.

7. **Write findings doc** — Go/no-go assessment in `.planning/workstreams/visual-identity-engine/research/FINDINGS.md`.

**Estimated time to first generated image:** ~4–6 hours total (dominated by training wait time, not coding time).

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│  SPIKE FLOW (local machine / Replit terminal)                     │
│                                                                   │
│  data/photos/ ──► [upload.ts] ──► provider storage (zip URL)     │
│                                         │                        │
│                                    [train.ts]                    │
│                                    POST training job             │
│                                    poll 30s intervals            │
│                                         │                        │
│                              outputs/training-result.json        │
│                                (weights URL / version handle)    │
│                                         │                        │
│                                   [generate.ts]                  │
│                                   run N prompts                  │
│                                   poll 3s intervals              │
│                                         │                        │
│                              outputs/gallery/                    │
│                              *.jpg + manifest.json               │
│                                         │                        │
│                              [founder review]                    │
│                              go / no-go decision                 │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│  PRODUCTION SHAPE (after go verdict — NOT built in spike)        │
│                                                                   │
│  artifacts/hermes ──► loraTrainingQueue ──► artifacts/worker     │
│                              (BullMQ)    lib/providers/image      │
│                                               │                  │
│                                         Replicate/fal.ai         │
│                                         (poll in worker)         │
│                                               │                  │
│                                    weights URL stored in DB      │
│                                    (lora_versions table)         │
│                                                                   │
│  fan request ──► artifacts/api-server ──► imageGenQueue          │
│                  entitlement check    ──► artifacts/worker        │
│                                         IImageProvider.enqueue   │
│                                               │                  │
│                                         generated_images table   │
│                                         signed URL to fan        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Integration Points

### External Services (spike)

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Replicate | `replicate` npm SDK; `POST /v1/trainings`, `GET /v1/trainings/{id}`, `replicate.run()` | Token in env var; training stores weights on Replicate CDN automatically |
| fal.ai (if switched) | `@fal-ai/client`; `fal.queue.submit`, `fal.queue.status`, `fal.queue.result` | Output is `diffusers_lora_file` URL; weights must be stored externally for long-term use |

### Internal Boundaries (production seam — not spike)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `lib/providers` ↔ `artifacts/worker` | Direct import of `IImageProvider` impl | Same pattern as text/voice |
| `artifacts/api-server` ↔ `lib/queue` | BullMQ queue definition from shared lib | Same pattern as voice |
| `lib/providers` ↔ `lib/twin-runtime` | No connection — image gen is NOT part of twin chat pipeline | Twin chat stays text/voice only |
| `artifacts/hermes` ↔ `loraTrainingQueue` | Hermes enqueues training job when creator completes onboarding | Admin-only trigger, not fan-triggered |

### What Does NOT Change in the Spike

- `lib/twin-runtime` — zero changes; image gen is not part of the moderation pipeline
- `artifacts/api-server` — zero new routes; spike is CLI-only
- `lib/db` — no new migration; weights URL lives in a file during spike
- `pnpm-workspace.yaml` — spike's `package.json` is NOT added as a workspace member
- Port mapping — unchanged; spike runs no server

---

## Anti-Patterns

### Anti-Pattern 1: Putting the spike inside artifacts/ or lib/

**What people do:** Create `artifacts/image-spike/` as a pnpm workspace member with its own Replit artifact entry.
**Why it's wrong:** Replit artifact system expects a running server on a fixed port. A CLI script that trains a LoRA and exits is not a server. Adding it to the workspace makes it appear in `pnpm run build` and `pnpm run typecheck`, polluting CI for every developer.
**Do this instead:** `spikes/` at repo root, standalone `package.json` not listed in `pnpm-workspace.yaml`, run via `npx tsx src/train.ts`.

### Anti-Pattern 2: Building IImageProvider before the spike returns findings

**What people do:** Pre-build the production interface layer before validating quality with real LoRA outputs.
**Why it's wrong:** The spike may reveal that Replicate's Flux LoRA quality is insufficient for Claire's specific look, requiring a switch to fal.ai's portrait-specific trainer, a different base model (e.g., Illustrious XL instead of FLUX.1), or a different training parameters profile. Building the production abstraction layer before knowing which provider to commit to means rewriting it.
**Do this instead:** Let `train.ts` and `generate.ts` be the exploratory draft of the future `IImageProvider.enqueueImageGeneration()` and `IImageProvider.getJobStatus()`. The interface shape is already obvious from the voice pattern; wait for the go verdict before adding it to `lib/providers`.

### Anti-Pattern 3: Storing weights only on provider CDN

**What people do:** Rely indefinitely on the provider-hosted weights URL for production inference.
**Why it's wrong:** Replicate's training output URLs may expire or be subject to account deletion. The creator owns her LoRA under the non-exclusive license (stated in `PROJECT.md` — "The creator owns her likeness, LoRA, voice clone"). If lala.la loses the weights URL, the creator's property is lost.
**Do this instead:** During production onboarding, download the `.safetensors` file and store in Replit Object Storage under `creators/{creator_id}/lora_weights/{version}.safetensors`. For the spike, just note the URL; downloading for archival is optional.

### Anti-Pattern 4: Running training on Replit

**What people do:** Try to run a local ComfyUI or kohya_ss training job on the Replit machine to avoid API costs.
**Why it's wrong:** Replit has no GPU. LoRA training on CPU for 1000 steps at FLUX scale would take many hours. The no-GPU constraint is structural (same constraint as voice, which is why GMI Cloud XTTS is used). Use a hosted training API.
**Do this instead:** Replicate or fal.ai hosted training. Under $2 per run, 20–40 minutes.

---

## Sources

- `lib/providers/src/providers/interfaces.ts` — actual `IVoiceProvider`, `IVideoProvider` interface shapes used as production seam model (HIGH confidence, direct read)
- `lib/providers/src/providers/registry.ts` — `ProviderRegistry`, `createRegistry` pattern (HIGH confidence, direct read)
- `lib/providers/src/providers/mocks.ts` — mock implementation patterns (HIGH confidence, direct read)
- `.planning/PROJECT.md` — "creator owns her LoRA", no-GPU constraint, Replit platform constraint (HIGH confidence, direct read)
- [Replicate: Fine-tune FLUX.1 with an API](https://replicate.com/blog/fine-tune-flux-with-an-api) — training API flow, polling, weights URL in `output.weights` (HIGH confidence, official source)
- [Replicate: Working with LoRAs](https://replicate.com/docs/guides/extend/working-with-loras) — inference with trained LoRA, `extra_lora` parameter pattern (MEDIUM confidence — storage retention policy not fully documented)
- [fal.ai: flux-lora-fast-training API](https://fal.ai/models/fal-ai/flux-lora-fast-training/api) — `fal.queue.submit/status/result` pattern, `diffusers_lora_file` output (HIGH confidence, official docs)
- [fal.ai: flux-lora-portrait-trainer](https://fal.ai/models/fal-ai/flux-lora-portrait-trainer) — portrait-specific trainer with segmentation masking (MEDIUM confidence — pricing confirmed, async docs sparse)
- [replicate npm package](https://www.npmjs.com/package/replicate) — official Node.js SDK (HIGH confidence)
- [Replicate: Webhooks](https://replicate.com/docs/webhooks) — webhook vs polling options for training jobs (HIGH confidence)

---
*Architecture research for: visual-identity-engine LoRA spike*
*Researched: 2026-06-01*
