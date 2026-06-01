# Stack Research: Visual Identity Engine (Image-Gen + LoRA Spike)

**Domain:** Photorealistic human-likeness reproduction via LoRA-finetuned diffusion model
**Researched:** 2026-06-01
**Confidence:** MEDIUM-HIGH (base-model and hosted-API sections are HIGH; GMI image capability is MEDIUM; FLUX.2 dev quality-vs-cost is MEDIUM based on multiple consistent community sources)

---

## The Illustrious XL Question — Answer First

**Illustrious XL is the wrong base model for this use case.** Illustrious is explicitly optimized for anime/illustration styles — it is, in the community's own words, "the anime version of FLUX." Training a creator-likeness LoRA on Illustrious would produce anime-stylized portraits of Claire, not photographic ones. Do not use it for a real-person-likeness spike.

The photorealistic portrait space has two relevant base model families in mid-2026:

| Model Family | Best For | Worst For |
|---|---|---|
| SDXL (Juggernaut XL, RealVisXL) | Faster inference, 10k+ community LoRAs | Prompt adherence is weaker than FLUX; older architecture |
| **FLUX.1 [dev]** | **Photorealistic skin/hair/eyes, strong prompt adherence, active LoRA ecosystem** | Slower (~4x SDXL), body proportions can skew heavy |
| FLUX.2 [dev] | FLUX.1 improvements + better facial anatomy + "training-friendly" design flag | Training costs 5-6x FLUX.1 on fal.ai ($8/1k steps vs ~$2.40); 32-80GB VRAM for self-hosted |

**Recommendation for spike: FLUX.1 [dev] + LoRA.**

Rationale:
- FLUX.1 dev is the de facto standard for photorealistic portrait LoRAs in 2025-2026; there is a large body of community evidence for creator-likeness use cases (20-30 images → convincing results).
- The hosted training cost is ~$1.46-$2.40 per run on Replicate/fal.ai — appropriate for a spike that may need 5-10 iterations.
- FLUX.2 dev has genuine quality improvements but its training cost ($8/1k steps on fal.ai) is 3-5x higher and the community track record for portrait LoRAs is thinner. Revisit at production if FLUX.1 results are insufficient.

**Personalization method: DreamBooth-style LoRA (not textual inversion, not full finetune).**

Rationale:
- DreamBooth-LoRA is the standard for person-likeness: 20-30 photos → rank-16 LoRA weights, ~3-5MB output file. It alters the model's weights in low-rank subspaces rather than embedding a token, yielding stronger identity preservation than pure textual inversion.
- Textual inversion alone (embedding-only) lacks the capacity to capture a real person's fine facial details — it works for style, not identity.
- Full finetune (DreamBooth without LoRA) would produce a forked model too large to iterate with cheaply.
- The hosted APIs (Replicate fast-flux-trainer, fal.ai flux-lora-portrait-trainer) both implement this pattern and abstract dataset captioning and subject-cropping.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| FLUX.1 [dev] | current (Black Forest Labs) | Base model for photorealistic portrait generation | Industry standard for photoreal LoRA work in 2025-2026; 12B parameter rectified-flow transformer; strong skin/hair/eye realism; verified by multiple community sources |
| DreamBooth-style LoRA (rank 16-32) | — | Personalization adapter for Claire's likeness | Correct method for person-identity preservation; produces ~3-5MB weight file; used by both Replicate and fal.ai fast-training endpoints |
| **Replicate** (primary recommendation) | API v1 | Hosted training + inference | ~$1.46/training run (1000 steps, 20 images, ~2 min on 8x H100); $0.025/output image; first-class Node.js SDK (`replicate@1.4.0`); TypeScript types built in; training API is simple (`replicate.trainings.create`). Most mature developer experience for a spike. |
| **fal.ai** (strong alternative) | API current | Hosted training + inference | flux-lora-fast-training: $2/run flat; flux-lora-portrait-trainer: $0.0024/step (~$2.40 for 1000 steps); inference: $0.025/image (Schnell) to $0.04 (Kontext Pro); `@fal-ai/client@1.10.1` — TypeScript-native, last published June 2026 |

### Supporting Libraries (spike glue only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `replicate` | ^1.4.0 | Replicate Node.js/TypeScript SDK | If using Replicate as the training/inference host |
| `@fal-ai/client` | ^1.10.1 | fal.ai TypeScript client | If using fal.ai as the training/inference host |
| `adm-zip` or `archiver` | ^5.x | Zip training images into a single archive before upload | Both Replicate and fal.ai expect a .zip of training images |
| `node-fetch` / native `fetch` (Node 24) | built-in | Download generated images from signed URLs | Node 24 has native fetch — no extra dep needed |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| JoyCaption (local or HF Space) | Auto-caption training images | Best captioner for FLUX LoRA training; generates natural-language sentences as FLUX expects. Use the HF Space version to avoid a local GPU requirement. |
| Florence-2 via `autocap` (alt) | Auto-caption training images | Lighter-weight alternative; GitHub: hoodini/autocap |
| Replicate web playground | Iterative prompt testing after training | No code needed for founder eval; useful for gallery generation before writing the API glue |

---

## GMI Cloud for Image Generation — Explicit Assessment

**LOW confidence, NOT recommended for this spike.**

What is known (MEDIUM confidence):
- GMI Cloud's MaaS layer does offer image generation models including FLUX variants (flux-kontext-pro, Flux2-Dev, Flux2-Klein confirmed in docs.gmicloud.ai as of June 2026).
- GMI Studio (launched Jan 2026) is a node-based workflow tool for multi-model pipelines, not a simple REST inference API.
- GMI Cloud's primary public OpenAI-compatible endpoint (`api.gmi-serving.com/v1`) is the LLM/text interface — the team already uses this for DeepSeek text generation.

What is NOT known / not findable:
- Whether GMI Cloud exposes a public REST endpoint for image inference in the same style as their LLM API (no URL found in public docs).
- Whether GMI Cloud offers LoRA training as a managed API (docs mention bare-metal H100/H200 that could run kohya_ss, but this is "rent a GPU" not "managed training endpoint").
- Pricing for image generation on GMI.

**Decision: Do not use GMI Cloud for the image-gen spike.** The LLM use of GMI is locked and correct. Image generation is a different product surface; GMI's image story is enterprise-oriented (batch workflows, dedicated GPUs). Replicate and fal.ai are purpose-built for this exact use case, have public pricing, and have Node.js SDKs that integrate trivially into the monorepo. Revisit GMI image if the project needs cost optimization at scale (creator #5+).

---

## Hosted API Comparison for the Spike

| Service | Training Cost | Training Time | Inference Cost | LoRA for FLUX.1 dev | Node.js SDK | Verdict |
|---------|---------------|---------------|----------------|---------------------|-------------|---------|
| **Replicate** | ~$1.46/run (1000 steps, fast-trainer) | ~2 min | $0.025/image | Yes (fast-flux-trainer, ostris/flux-dev-lora-trainer) | `replicate@1.4.0` — mature, typed | **Recommended** |
| **fal.ai** | $2/run (fast) or $2.40/1000 steps (portrait-trainer) | Not published; community reports similar to Replicate | $0.025-$0.04/image | Yes (flux-lora-fast-training, flux-lora-portrait-trainer) | `@fal-ai/client@1.10.1` — TypeScript-native, updated June 2026 | Strong alternative |
| RunPod Serverless | ~$2-4/run at H100 serverless rates ($5.59/hr); manual setup | Manual; no managed endpoint | ~$0.01-0.03/image | Manual container deployment | None native; raw HTTP | Not recommended for spike — setup overhead too high |
| GMI Cloud | Unknown; likely bare-metal rental | Unknown | Unknown | Unknown | None for images | Not recommended — no public API found |
| Raw GPU (Lambda, Vast.ai) | $0.50-$2/hr; more work | Hours of setup | Manual | Manual kohya_ss setup | None | Not recommended for spike |

**Primary recommendation: Replicate.** Reasons:
1. The `fast-flux-trainer` model is mature, actively maintained, and the training API is 10 lines of TypeScript.
2. ~$1.46/run means the founder can iterate 10 times for ~$15 to find the best dataset/step combination.
3. After training, inference is `replicate.run("owner/model:version", { input: { prompt } })` — the gallery-generation script is <50 lines.
4. The Node.js SDK has proper TypeScript types and is used by the official Replicate documentation examples.

**fal.ai is a viable alternative** and has a portrait-specific trainer (`flux-lora-portrait-trainer`) that does automated subject cropping and mask generation — potentially better likeness quality for the same cost. If Replicate results are underwhelming after 2-3 iterations, try fal.ai's portrait trainer.

---

## Training Tooling and Dataset Requirements

### Dataset Requirements for Person-Likeness LoRA

| Parameter | Minimum | Recommended | Notes |
|-----------|---------|-------------|-------|
| Number of images | 10-12 | 20-30 | More than ~40 has diminishing returns for FLUX.1 |
| Resolution | 512×512 | 1024×1024 or native | Hosted services auto-crop/resize; higher is better |
| Format | JPG/PNG | WebP or PNG | Avoid heavy JPEG compression artifacts |
| Diversity | — | Vary angles, lighting, clothing, backgrounds | 2-3 closeup/face, 2-3 left/right 45°, 2-3 waist-up, 2-3 full-body |
| Quality | — | In-focus, no filters, no watermarks | Consistent skin/makeup look across images helps identity |

### Captioning Strategy

FLUX is trained on natural-language sentence data, not short tag-lists (unlike SD1.5). Caption strategy matters significantly.

1. Use auto-captioning first: JoyCaption (HF Space, free) or fal.ai/Replicate's built-in autocaptioning (both services handle this automatically when given a zip with no caption files).
2. Every caption should start with the trigger word (e.g., `CLAIRE_TWIN`) and include pose, clothing, lighting, expression.
3. Do NOT caption the trigger word's physical attributes into every image (eye color, hair color) — this locks those attributes to the token. Describe them in individual image captions only if they vary.

### Training Steps and Hyperparameters

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| Steps | 1000 (start) | Standard default on both Replicate and fal.ai; for 20 images, this is 50 effective epochs |
| LoRA rank | 16-32 | Rank 16 = smaller file, faster, usually sufficient for single person; rank 32 for higher fidelity |
| Learning rate | 1e-4 → 5e-5 | FLUX is more LR-sensitive than SDXL; hosted services default to 0.00009 |
| Trigger word | Unique non-dictionary token (e.g., `CLAIRE_V1`) | Avoid common words; case-insensitive |

**Expected training cost on Replicate:** ~$1.46 per run at default settings (1000 steps, fast-trainer). A 5-run iteration cycle costs ~$7.

**Expected training cost on fal.ai portrait-trainer:** ~$2.40 per run (1000 steps at $0.0024/step). Same iteration cycle ~$12.

### Underlying Training Library

Both Replicate and fal.ai use **ostris/ai-toolkit** (the standard FLUX LoRA training toolkit, also powers the official Black Forest Labs fine-tuning workflow) under the hood, though this is abstracted by their APIs. You do not need to install or configure ai-toolkit directly for the spike. If self-hosted training is needed later (cost scale), ai-toolkit + a rented RunPod H100 is the path.

---

## Minimal TypeScript Glue for the Spike

The spike needs three scripts total. These live in a new artifact `artifacts/image-spike/` (not wired into the main API server). No production infrastructure, no moderation, no object storage pipeline.

### Script 1: `train.ts` — kick off a training run

```typescript
import Replicate from "replicate";
import { createReadStream } from "fs";
// Zip your training images into /tmp/claire-dataset.zip first
// e.g. with: zip -j /tmp/claire-dataset.zip ./training-images/*.jpg

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const training = await replicate.trainings.create(
  "replicate",
  "fast-flux-trainer",
  "TRAINER_VERSION_ID", // check replicate.com/replicate/fast-flux-trainer for latest
  {
    destination: "your-username/claire-lora",
    input: {
      input_images: "https://your-signed-url-to-zip", // upload zip first
      trigger_word: "CLAIRE_V1",
      lora_type: "subject",
      training_steps: 1000,
    },
  }
);
console.log("Training ID:", training.id);
```

### Script 2: `generate.ts` — generate the eval gallery

```typescript
import Replicate from "replicate";
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

const PROMPTS = [
  "CLAIRE_V1, professional photo, soft studio lighting, looking at camera",
  "CLAIRE_V1, candid outdoor photo, natural light, smiling",
  "CLAIRE_V1, waist-up portrait, evening event, elegant",
  // ... 10-15 gallery prompts
];

for (const prompt of PROMPTS) {
  const output = await replicate.run("your-username/claire-lora:VERSION", {
    input: { prompt, num_inference_steps: 28, guidance_scale: 3.5 },
  });
  // output is a URL string; fetch and save
}
```

### Script 3: `findings.md` — the spike deliverable

Founder fills this in manually after reviewing the gallery:
- Provider used, training run ID
- Cost: training + N inference images
- Training time
- Dataset: number of photos, captioning method
- Subjective likeness verdict (1-5 scale, annotated gallery)
- Go/no-go recommendation

---

## Installation (spike artifact only)

```bash
# In artifacts/image-spike/ (new directory, not wired into main monorepo build)
pnpm add replicate           # ^1.4.0
# OR
pnpm add @fal-ai/client      # ^1.10.1 if using fal.ai
```

No other deps required. Node 24 native `fetch` handles image downloads. `archiver` or `adm-zip` is optional if you pre-zip images manually.

---

## Alternatives Considered

| Recommended | Alternative | When Alternative Is Better |
|-------------|-------------|---------------------------|
| FLUX.1 [dev] + LoRA | FLUX.2 [dev] + LoRA | If FLUX.1 results are unsatisfactory after 3-5 iterations AND you need the extra facial detail improvement AND you can absorb 5x training cost ($8/run on fal.ai) |
| FLUX.1 [dev] + LoRA | SDXL + Juggernaut XL LoRA | If inference speed is the primary constraint (SDXL is ~4x faster) and moderate photorealism is acceptable; not recommended for creator-likeness where identity fidelity is the metric |
| FLUX.1 [dev] + LoRA | Illustrious XL + LoRA | Never for photorealistic portrait likeness — Illustrious is anime-only |
| FLUX.1 [dev] + LoRA | InstantID / IP-Adapter | Zero-shot face consistency at inference time without training; avoids the training run entirely. Valid alternative if dataset is very small (<10 images). But less identity-stable across prompts than a trained LoRA. Replicate has `zsxkib/instant-id`. Worth a parallel test. |
| Replicate | fal.ai | Portrait-specific training with auto subject-crop/mask; if Replicate likeness results disappoint after 2-3 runs |
| Replicate | RunPod + ai-toolkit | At scale (>100 runs/month) where API markup becomes significant; overkill for a spike |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Illustrious XL | Anime-specialized; produces stylized illustrations, not photographic portraits of real people | FLUX.1 [dev] |
| Textual inversion (embedding-only) | Insufficient capacity for real person identity; captures texture/style, not facial geometry | DreamBooth-LoRA |
| Full DreamBooth (no LoRA) | Produces a full forked model (GBs); expensive to host, iterate, and store | DreamBooth-LoRA (produces a ~3-5MB .safetensors file) |
| GMI Cloud for image gen | No confirmed public REST API for image inference; no managed LoRA training endpoint; docs point to bare-metal rental or enterprise workflow tool | Replicate or fal.ai |
| ElevenLabs (visual) | Not relevant | — |
| Local GPU / self-hosted training | Requires 24GB VRAM minimum for FLUX.1 LoRA; no GPU on Replit; setup overhead kills spike speed | Replicate or fal.ai managed training |
| Production moderation pipeline, object storage, serving infra | Out of scope for spike — outputs stay founder-internal | Add at productionization milestone |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `replicate@^1.4.0` | Node 24, TypeScript 5.x, ESM | Confirmed current version as of June 2026; exports TypeScript types; works with `"type": "module"` packages |
| `@fal-ai/client@^1.10.1` | Node 24, TypeScript 5.x, ESM | Last published June 2026 (2 days prior to research date); TypeScript-native; fal.ai states this as the current stable client |
| FLUX.1 [dev] (base model) | FLUX.2 LoRA? No. FLUX.1 LoRAs only | LoRA weights trained on FLUX.1 dev are NOT compatible with FLUX.2 dev or SDXL |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Base model recommendation (FLUX.1 dev vs Illustrious) | HIGH | Multiple independent sources confirm Illustrious is anime-only; FLUX.1 dev photorealism is well-documented |
| Personalization method (DreamBooth-LoRA) | HIGH | Industry consensus; both hosted platforms implement this pattern |
| Replicate pricing and API | HIGH | Verified against replicate.com/pricing and official docs; $0.025/image, ~$1.46/training run |
| fal.ai pricing and API | HIGH | Verified against fal.ai pricing page and API docs; $2/run (fast), $2.40/1000 steps (portrait trainer) |
| GMI Cloud image generation capability | LOW | Docs confirm image category exists and FLUX model names appear in catalog, but no confirmed public REST endpoint or pricing found; not recommended for spike |
| FLUX.2 dev portrait quality improvement | MEDIUM | Some community sources report improvements; architectural change is real (32B params vs 12B); limited head-to-head LoRA portrait comparisons found |
| Dataset requirements (20-30 images) | HIGH | Consistent across multiple independent guides and both hosted platform docs |
| Training time (~2 min on Replicate fast-trainer) | HIGH | Official Replicate changelog confirms |

---

## Sources

- [Replicate: Fine-tune FLUX.1 with your own images](https://replicate.com/blog/fine-tune-flux) — dataset requirements, training flow — HIGH confidence
- [Replicate: Faster, cheaper Flux training (2025-05-23)](https://replicate.com/changelog/2025-05-23-faster-flux-trainer) — ~2 min, under $2 — HIGH confidence
- [Replicate pricing](https://replicate.com/pricing) — $0.025/image FLUX.1 dev; $0.001528/sec H100 training — HIGH confidence (verified via WebFetch)
- [Replicate: Fine-tune FLUX.1 with an API](https://replicate.com/docs/get-started/fine-tune-with-flux) — full Node.js API walkthrough — HIGH confidence
- [fal.ai: flux-lora-fast-training](https://fal.ai/models/fal-ai/flux-lora-fast-training) — $2/run API — HIGH confidence
- [fal.ai: flux-lora-portrait-trainer API](https://fal.ai/models/fal-ai/flux-lora-portrait-trainer/api) — $0.0024/step, 10+ images — HIGH confidence
- [fal.ai: FLUX.2 dev Trainer](https://fal.ai/models/fal-ai/flux-2-trainer) — $0.008/step, 9-50 images — HIGH confidence
- [fal.ai: FLUX.2 now available blog](https://blog.fal.ai/flux-2-is-now-available-on-fal/) — FLUX.2 dev LoRA confirmed on fal — HIGH confidence
- [Pelayo Arbues: Training a Personal LoRA on Replicate Using FLUX.1-dev](https://www.pelayoarbues.com/notes/Training-a-Personal-LoRA-on-Replicate-Using-FLUX.1-dev) — real-person likeness walkthrough — MEDIUM confidence (practitioner source)
- [What Exactly to Caption for Flux LoRA Training](https://www.pelayoarbues.com/literature-notes/Articles/What-Exactly-to-Caption-for-Flux-LoRa-Training) — captioning best practices — MEDIUM confidence
- [SeaArt: Illustrious Model Series Guide](https://www.seaart.ai/articleDetail/ctuib45e878c73ekrc90) — confirms Illustrious is anime-specialized — HIGH confidence
- [Stable Diffusion Art: SDXL vs FLUX comparison](https://stable-diffusion-art.com/sdxl-vs-flux/) — photorealism comparison — MEDIUM confidence
- [GMI Cloud docs: image model quickstarts](https://docs.gmicloud.ai/model-quickstarts/image/overview) — FLUX models listed in catalog — LOW confidence for API availability
- [@fal-ai/client npm](https://www.npmjs.com/package/@fal-ai/client) — version 1.10.1, published June 2026 — HIGH confidence
- [replicate npm](https://www.npmjs.com/package/replicate) — version 1.4.0 — HIGH confidence (npm view confirmed)
- [ostris/ai-toolkit GitHub](https://github.com/ostris/ai-toolkit) — underlying training library for both Replicate and fal.ai — HIGH confidence
- [HuggingFace: Advanced Flux DreamBooth LoRA Training](https://huggingface.co/blog/linoyts/new-advanced-flux-dreambooth-lora) — DreamBooth-LoRA method — HIGH confidence

---

*Stack research for: visual-identity-engine — image-gen + LoRA spike*
*Researched: 2026-06-01*
