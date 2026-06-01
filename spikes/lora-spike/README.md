# lora-spike — FLUX.1 LoRA likeness test (THROWAWAY)

A self-contained R&D spike that trains a FLUX.1 LoRA on a creator's photos via **Replicate**,
generates a strength-grid eval gallery, and renders it as a browsable `gallery.html`.

This is **not production code**. It lives outside the pnpm workspace, in `spikes/`. The
production path (an `IImageProvider` in `lib/providers`, BullMQ jobs, fan-facing delivery) is
intentionally **not** built here — that waits for the go/no-go verdict and the consent gate.

## Scope guardrails (GATE-04)
- **SFW only.** Prompts in `src/config.ts` must stay safe-for-work.
- **Founder-internal only.** Do not share the generated images or the `.safetensors` LoRA.
- **Not fan-facing.** Do not wire this into `lala.la/[handle]` or the fan-twin bot. A signed
  image-generation consent addendum is required before any output leaves founder-internal scope.

## Setup
```bash
cd spikes/lora-spike
pnpm install
cp .env.example .env      # then fill REPLICATE_API_TOKEN + REPLICATE_OWNER
```
Photos already staged in `data/photos/claire/` (gitignored).

## Run
```bash
pnpm train      # zip photos → train LoRA on Replicate → outputs/training-result.json   (~$1.5, ~few min)
pnpm generate   # prompt × strength × seed grid + bleed check → outputs/gallery/         (~$0.025/image)
pnpm gallery    # build outputs/gallery/gallery.html  (+ optional founder-Telegram ping)
pnpm serve      # serve the gallery on a port (handy on Replit) → open gallery.html
# or: pnpm all   (train → generate → gallery)
```

Estimated total: **~$15–25** across a few training iterations.

## Tuning (`src/config.ts`)
- `triggerWord`, `training.steps` (drop if overfit / "same-face", raise if it doesn't look like her),
  `training.loraRank` (16→32 for more fidelity).
- `generation.loraScales` — the strength sweep shown as gallery columns.
- `prompts` — keep `{trigger}` as the subject; SFW only.

## After the run
- **TRAIN-03 / data minimization:** delete the uploaded dataset from your Replicate account once the
  trained model exists. Download the `.safetensors` weights to lala.la-controlled storage if you keep them.
- **DOC-01/02:** record provider, cost-per-image, training time, and a go/no-go likeness verdict.

## What this does NOT do
No fan-facing surface, no moderation of outputs, no DB writes, no production provider abstraction.
Throwaway by design — delete `spikes/lora-spike/` when the spike is done.
