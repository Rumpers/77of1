# Feature Research

**Domain:** Creator-likeness LoRA training spike (image generation, R&D / founder eval)
**Researched:** 2026-06-01
**Confidence:** HIGH (workflow steps and quality signals are well-documented by practitioners; specific provider/cost numbers are MEDIUM until a training run is executed)

---

## Spike Purpose and Scope Boundary

This is a de-risking R&D spike, NOT a product feature build. The only deliverable is:
- A founder eval gallery (generated images of Claire's likeness across a small prompt grid)
- A findings doc recording: provider/model used, training time, cost-per-image, subjective likeness verdict, go/no-go recommendation for productionizing

Nothing ships to fans this milestone. No serving infrastructure. No content policy. No API.

---

## End-to-End Workflow (Discrete, Observable Steps)

Each step is a gate: if the output is not acceptable, the step repeats before proceeding.

### Step 1 — Source Photo Collection and Curation

**Input:** Creator's existing photos (phone camera, social media exports, event shots)
**Process:**
- Pull all available photos of Claire
- Filter: keep only photos where Claire's face is clearly visible, unobstructed, and fills at least 30–40% of the frame
- Reject: group shots (multiple faces confuse training), heavy filters/effects, severe motion blur, thick text overlays or watermarks, extreme side profiles (> ~60 deg from front-facing)
- Target count: 20–30 images is the practical floor for flexible likeness; 30–50 is better. Under 15 is too few — the LoRA will overfit and become rigid.
- Diversity requirements (each dimension reduces the same-face/same-pose collapse problem):
  - At least 3 distinct lighting conditions (natural window, outdoor, indoor artificial)
  - At least 3 facial expressions (neutral, smiling, other)
  - At least 3 angles (front, 3/4, slight profile)
  - Mix of distances: 8–12 close crops (face fills frame), 5–8 medium shots (shoulders/torso visible), 2–4 full-body or environmental shots
  - Background variety: avoid all images sharing the same background color or setting

**Output:** Curated folder of 20–50 acceptable source images, numbered sequentially.
**Observable quality signal:** All rejected images documented with rejection reason. Retained set visually diverse — no run of 5+ images that look compositionally identical.

---

### Step 2 — Image Preprocessing (Crop and Resize)

**Input:** Curated source photos (mixed resolutions and aspect ratios)
**Process:**
- Crop each image to the target training resolution: 512x512 or 1024x1024 squares (1024 preferred for SDXL/FLUX-based models)
- For face-focused crops: center the face, allow ~10–20% of frame as chin/forehead margin
- For medium and full-body shots: crop to include the full person without significant dead space
- Resize to exact training resolution — do NOT letterbox or pad with black bars (degraded training signal)
- Tools: any batch cropper works; Birme, Python+Pillow, or the auto-crop in the training framework's dataset utilities

**Output:** Uniformly-sized image folder (all PNG or all JPG at training resolution).
**Observable quality signal:** All images are the same pixel dimensions. No letterboxing. No blurriness introduced by upscaling low-res originals (discard originals below ~600px in the face dimension rather than upscaling).

---

### Step 3 — Captioning

**Input:** Preprocessed images
**Process:**
- Generate a text file (.txt) paired with each image that describes what is in the image WITHOUT identifying the person
- Strategy: describe lighting, pose, expression, clothing, background, composition — but use a trigger word (e.g., `clrphoto`) instead of Claire's name or any identity markers (hair color, eye color, distinctive features) that you want baked into the LoRA rather than injected at inference time
- Auto-captioning tools: Qwen3-VL or WD14-Tagger are current best options; Qwen3-VL is preferred for photorealistic images as it produces fewer hallucinated details than Florence-2
- Manual review: verify each caption does not leak identity traits you want the LoRA to hold intrinsically (e.g., if you want the LoRA to always produce her eye shape, do not caption "almond-shaped dark eyes")
- Trigger word: short, rare, not a real word — e.g., `clrphoto`, `vclaire2025`. Include at the start of every caption.

**Output:** One .txt file per image, same base filename, with 1–3 sentence natural language caption starting with the trigger word.
**Observable quality signal:** Every image has a paired caption. No captions reference the person's real name or identity-defining physical traits.

---

### Step 4 — Training

**Input:** Preprocessed image+caption pairs, choice of base model, hyperparameters
**Process (recommended approach):**
- Base model: FLUX.1-dev or Illustrious-XL. FLUX.1-dev is the current state-of-the-art for photorealistic person generation (HIGH confidence — dominant in 2025–2026 practitioner community); Illustrious-XL for more stylized or anime-adjacent outputs.
- Training framework: AI-Toolkit (ostris/ai-toolkit on GitHub) for FLUX; Kohya_ss for SDXL/Illustrious
- LoRA rank: 32–64 for person likeness (higher rank = more identity capacity; 16 is enough for style, insufficient for face identity)
- Optimizer: Prodigy (auto-tunes learning rate, prevents the convergence failures that plague adamw8bit for character training)
- Steps: ~1000–2000 for FLUX with 20–30 images; ~1500–3000 for SDXL/Illustrious. Too few = undertrained (vague resemblance), too many = overfit (rigid, refuses prompt diversity)
- Sample generation during training: configure framework to generate sample images every 100–200 steps using 3–5 fixed reference prompts with fixed seeds. This is the single most important training-time quality signal.
- Save checkpoints at every 200–500 steps — the best checkpoint is often NOT the final one (typically epochs 4–7 of 10 for SDXL; mid-training for FLUX)
- Hardware: requires 12GB+ VRAM GPU. Replit does not have GPU — training must run on external compute (RunPod, Modal, Replicate, or local GPU machine).

**Output:** Multiple LoRA checkpoint files (.safetensors) at each save interval + a folder of sample images generated during training at each checkpoint.
**Observable quality signal:** Mid-training samples show progressive identity strengthening across steps. If samples look identical from step 500 onward, training has plateaued. If samples at step 1500+ look identical to the raw training images (face frozen, no variation with prompt changes), overfitting has begun.

---

### Step 5 — Generation with Prompt and Seed Control

**Input:** Best-checkpoint LoRA, base model, prompt grid plan
**Process:**
- Run a structured prompt grid to systematically test what the LoRA can and cannot do
- Fix seed across the grid to isolate variable effects
- Grid dimensions for the eval gallery:
  - **LoRA strength axis:** 0.6, 0.8, 1.0, 1.2 — identifies the Goldilocks zone (too low = face disappears, too high = rigid/artifact-prone)
  - **Scene/context axis:** neutral headshot, outdoor casual, different outfit, different expression (smile vs neutral vs surprised), different lighting condition
  - **Checkpoint axis:** sample from 2–3 checkpoint epochs to compare mid vs late training

**Output:** Grid of generated images — minimum 20–30 distinct images covering all axes. Save all with metadata (seed, LoRA strength, checkpoint version, prompt).
**Observable quality signal:** Images across the strength axis show gradual identity expression. At least one strength value produces clearly recognizable likeness AND varies correctly with scene/context prompts.

---

### Step 6 — Evaluation

**Input:** Generated eval gallery + source reference photos
**Process:** (see full eval protocol below)

**Output:** Completed findings doc with go/no-go verdict.

---

## What Makes a LoRA Good vs Bad: Quality Signals for the Founder Eval

### Identity Fidelity (the primary axis)

| Signal | Good | Bad |
|--------|------|-----|
| Face recognition (subjective) | Founder looking at generated image says "that's Claire" unprompted | Could be anyone; generic attractive woman |
| Distinctive feature retention | Characteristic features (jaw line, eye shape, nose profile, skin tone) present consistently | Features drift generation to generation |
| Consistency across seeds | Same LoRA + different seeds produce recognizably the same person | Each seed produces a different-looking person |

### Flexibility (avoids overfit "same-face" syndrome)

| Signal | Good | Bad |
|--------|------|-----|
| Outfit compliance | "wearing a red dress" generates Claire in a red dress | Always generates the outfit from a training photo |
| Scene compliance | "outdoor in a park" places her in a park | Always generates her indoors regardless of prompt |
| Expression compliance | "laughing" generates a convincing laugh | Same neutral expression regardless of prompt |
| Angle compliance | "profile view" produces a true profile | Always faces forward (overfit to frontal training images) |

### Technical Cleanliness

| Signal | Good | Bad |
|--------|------|-----|
| No bleed | A prompt with no trigger word produces a normal image | LoRA bleeds likeness into all generations (overfit to model weights) |
| No artifacts | Skin, hair, hands render cleanly | Texture artifacts, hand deformities, skin noise |
| Resolution | Face detail holds at 1024x1024 | Muddy or overly smoothed face at full resolution |

---

## Pragmatic Eval Protocol for the Spike

This protocol is designed to take 1–2 hours of founder time after the training run completes.

### Phase A — Bleed Check (5 minutes, automated)

Generate 5 images using the base model with NO LoRA active, and 5 images with the LoRA active but using prompts that contain NO trigger word. If the second set shows Claire's face, the LoRA is overfit and needs retraining with fewer steps or lower learning rate. This is a pass/fail gate before proceeding.

### Phase B — Identity Recognition Test (15 minutes, subjective)

Generate 10 images with varied scene prompts and the trigger word. Cover: 2 neutral headshots, 2 different outfits, 2 different expressions, 2 different backgrounds, 2 different angles. Print/display side-by-side with 3 reference photos. Founder makes a binary call per image: "recognizable as Claire" or "not". Target: 7/10 pass. If below 7/10, document which images failed and why (feature drift? wrong hair? generic face?) before proceeding.

### Phase C — Flexibility Test (15 minutes, grid)

Run LoRA strength sweep at 0.6 / 0.8 / 1.0 / 1.2 with a fixed seed and 3 prompts:
1. "headshot of [trigger], plain white background"
2. "[trigger] at a beach, sunset lighting, casual outfit"
3. "[trigger] formal attire, indoor professional setting"

Inspect: Does the face change correctly with strength? Does the scene context comply at each strength level? Document optimal strength value.

### Phase D — Checkpoint Comparison (10 minutes)

If multiple checkpoints were saved, compare the best mid-training checkpoint vs. the final checkpoint on the same 3 prompts from Phase C with a fixed seed. Often the mid-training checkpoint outperforms the final one for flexibility. Select the better checkpoint.

### Phase E — Optional: ArcFace Similarity Score (30 minutes, technical, LOW priority for spike)

If founder wants an objective number to compare future training runs: run InsightFace's ArcFace model against 5 reference photos and 5 generated images. Compute cosine similarity. A score above 0.4 is recognizable; above 0.6 is strong likeness. This is optional for the spike — subjective Phase B verdict is sufficient for the go/no-go decision. Include if you want a replicable baseline for future creator #2 onboarding.

### Findings Doc Output

After Phases A–D (and optionally E), record:
- Base model used + LoRA framework
- Training compute: GPU type, training time, total cost
- Dataset: number of photos, source
- Best checkpoint step number
- Optimal LoRA strength
- Phase B pass rate (X/10 recognizable)
- 3 representative eval gallery images (neutral, varied scene, varied expression)
- Go / No-Go verdict with one-sentence rationale

---

## Feature Landscape

### Table Stakes (Required for the Spike to Be Meaningful)

| Feature | Why Required | Complexity | Notes |
|---------|--------------|------------|-------|
| Curated dataset of 20–30 Claire photos with angle/lighting/expression variety | Without variety, LoRA is rigid and the eval cannot assess flexibility — the core question of the spike | LOW | Manual curation; no tooling needed |
| Image preprocessing to uniform training resolution (1024x1024) | Mismatched resolutions corrupt training; non-negotiable | LOW | One-time batch operation using Birme or Python+Pillow |
| Per-image caption files with trigger word | Captioning is what teaches the model to separate Claire's identity from scene context; without it, the LoRA cannot be prompted to vary | MEDIUM | Qwen3-VL or WD14-Tagger auto-caption + manual review pass |
| Training run on an external GPU (not Replit) | Replit has no GPU; 12GB+ VRAM required for FLUX or SDXL training | MEDIUM | RunPod / Modal / Replicate one-off run; ~$2–5 for a typical run |
| Checkpoint saves every 200–500 steps with sample images | Without intermediate checkpoints, you cannot detect the optimal stopping point and risk overfit | LOW | Configuration option in AI-Toolkit / Kohya_ss |
| Structured prompt grid for generation (LoRA strength + scene axes) | Eval gallery without a grid just shows cherry-picked images; the grid reveals flexibility limits | LOW | Manual execution in ComfyUI or equivalent |
| Founder identity recognition test (Phase B: 7/10 threshold) | This IS the go/no-go gate; without a defined pass threshold it is not a spike, just vibes | LOW | Founder time: ~15 minutes |
| Findings doc with cost/time/verdict fields | The spike's only artifact that feeds the productionization decision | LOW | Markdown file |

### Differentiators (Nice-to-Have for the Spike)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| ArcFace cosine similarity baseline score | Gives a replicable numeric baseline so that future creator #2 runs can be compared objectively, not just subjectively | MEDIUM | InsightFace Python library; ~30 min setup; optional for spike |
| Multi-checkpoint comparison (mid vs late training) | Often reveals that the optimal checkpoint is not the final one; avoids silent quality degradation | LOW | Just need to save 2–3 checkpoints and run the same prompts against each |
| Bleed test (LoRA active, no trigger word) | Detects overfit before wasting time on the full eval gallery | LOW | 5-image generation, ~2 minutes; high signal-to-effort ratio, worth including |
| Side-by-side reference comparison layout in gallery | Makes founder review faster and less prone to wishful thinking | LOW | Export tool (HTML grid or Figma) |
| Second training run with adjusted hyperparameters if first run fails Phase B | Makes the spike a true learning loop, not a one-shot | MEDIUM | Adds ~1 day; only worthwhile if first run fails at ≥ 5/10 |

### Anti-Features (Explicitly DO NOT Build in This Spike)

| Feature | Why Requested | Why It Breaks the Spike | What to Do Instead |
|---------|---------------|-------------------------|--------------------|
| Fan-facing image serving / CDN endpoint | "We should put the best images somewhere fans can see them" | Content policy, consent, and brand review not done; serving infra adds weeks | Keep gallery as local founder files only |
| NSFW image generation | FLUX/SDXL are capable; easy to do | TAKE IT DOWN Act, California AB 602, personality-rights agreement not scoped for image use; legal exposure on Day 1 | Restrict all generated images to fully-clothed, contextually neutral content |
| Real-time / on-demand generation API | "Let's wire it to the fan page now that we have a LoRA" | Requires GPU serving (cost 10x vs batch), CDN, rate limiting, content filtering — a separate 2–3 week build | The spike is batch only; serving is a future milestone |
| Fine-tuning for multiple creators simultaneously | "Let's do creator #2 at the same time" | Doubles dataset/training complexity; findings are per-creator and may not transfer | One creator (Claire) only; use findings doc to templatize process for creator #2 |
| Video generation from LoRA stills | "Can we animate these?" | Completely different pipeline (AnimateDiff, CogVideoX, etc.); no shared infrastructure | Separate workstream; out of scope for image spike |
| Automated quality scoring (FID, IS, LPIPS) | "Let's make it rigorous" | Requires a reference distribution of Claire photos that is too small for meaningful FID computation; adds tooling complexity with low signal | ArcFace cosine similarity (optional) is sufficient; founder subjective review is the primary gate |
| Public gallery / social media posting | "Let's show these to Claire for feedback" | Creator consent for AI-generated image review not yet structured; could cause brand/PR issues before model is validated | Founder-only internal review only |
| Prompt engineering UI / gallery browser app | "We should build a nice UI for reviewing" | Scope creep; the gallery is a folder of images + a markdown doc | Use a file manager or simple HTML export |

---

## Feature Dependencies

```
Step 1: Source photo collection and curation
    └──required-by──> Step 2: Image preprocessing
                          └──required-by──> Step 3: Captioning
                                                └──required-by──> Step 4: Training run
                                                                      └──required-by──> Step 5: Generation grid
                                                                                            └──required-by──> Step 6: Evaluation / findings doc

Step 4 (checkpoint saves every N steps)
    └──enables──> Step 4b: Mid-training bleed check (early stopping if overfit detected)
    └──enables──> Step 6d: Checkpoint comparison in eval

Step 1 (dataset variety: angles/lighting/expression)
    └──directly-determines──> Flexibility axis in Step 6 evaluation
                              (rigid dataset → rigid LoRA → flexibility axis fails regardless of training params)
```

### Dependency Notes

- **Step 1 diversity determines Step 6 flexibility:** The single biggest predictor of whether the eval gallery will show flexibility is dataset diversity. If all source photos are front-facing neutral-expression selfies, the LoRA will overfit to that pose regardless of training parameters. Curation is the highest-leverage step.
- **Step 3 captioning strategy determines Step 5 prompt compliance:** If identity traits (eye color, hair texture) are left in captions rather than baked into the trigger word, those traits will need to be re-specified at inference time, making generation noisier. Decide at captioning time what is "baked" vs "prompted."
- **Step 4 checkpoint saves enable Step 6d checkpoint comparison:** Must configure before training starts; cannot recover intermediate checkpoints retroactively.
- **Phase A bleed check gates Phase B–E eval:** If bleed check fails, the eval gallery is not meaningful — stop and retrain before proceeding.

---

## MVP Definition

### Launch With (spike v1 — the actual deliverable)

- [ ] Curated dataset: 20–30 Claire photos with documented diversity (angles, lighting, expressions) — **prerequisite for everything else**
- [ ] Preprocessed images at 1024x1024 with per-image caption files and trigger word
- [ ] One training run on external GPU (FLUX.1-dev recommended; Illustrious-XL as fallback if FLUX cost is prohibitive)
- [ ] Checkpoint saves at every 200–500 steps with sample generation
- [ ] Prompt grid: LoRA strength sweep (0.6 / 0.8 / 1.0 / 1.2) x 3 scene prompts x 2 checkpoints = ~24 images
- [ ] Founder Phase A–D eval (bleed check → identity test → flexibility test → checkpoint comparison)
- [ ] Findings doc: model, cost, training time, Phase B pass rate, optimal strength, go/no-go

### Add After Validation (if go decision)

- [ ] ArcFace baseline score — adds a reproducible numeric benchmark before scaling to creator #2
- [ ] Second training run with adjusted hyperparameters — only if first run Phase B < 7/10
- [ ] Creator review session — show best gallery images to Claire for consent and quality feedback before productionizing

### Future Consideration (if go decision → productionization milestone)

- [ ] GPU serving infrastructure (RunPod Serverless, Modal, or Replicate) for on-demand generation
- [ ] Content policy for generated images (what is and is not permitted per personality-rights agreement)
- [ ] Integration with fan-facing surface (API endpoint, CDN, rate limiting)
- [ ] LoRA onboarding flow for creator #2 (templatized dataset collection guide, automated captioning pipeline)

---

## Feature Prioritization Matrix

| Feature | Founder Value for Spike | Implementation Cost | Priority |
|---------|-------------------------|---------------------|----------|
| Dataset curation (20–30 diverse Claire photos) | HIGH — entire spike depends on this | LOW — founder time only | P1 |
| Image preprocessing + captioning | HIGH — required for training | LOW | P1 |
| Training run on external GPU | HIGH — the core experiment | MEDIUM — new compute environment | P1 |
| Structured eval gallery (prompt grid) | HIGH — reveals flexibility limits | LOW — manual generation | P1 |
| Founder identity recognition test (Phase B) | HIGH — the go/no-go gate | LOW — founder time only | P1 |
| Findings doc | HIGH — spike's only persistent artifact | LOW | P1 |
| Bleed check (Phase A) | MEDIUM — early warning of overfit | LOW — 5-image test | P2 |
| Checkpoint comparison | MEDIUM — finds optimal checkpoint | LOW | P2 |
| ArcFace cosine similarity | LOW for spike, MEDIUM for future | MEDIUM — Python tooling setup | P3 |
| Second training run (if first fails) | MEDIUM — only if Phase B < 7/10 | MEDIUM — adds ~1 day | P2 (conditional) |

**Priority key:**
- P1: Must have for the spike to produce a go/no-go verdict
- P2: Should include, meaningfully improves the findings
- P3: Nice to have, defer unless Phase B result is borderline

---

## Sources

- [SDXL Photorealistic LoRA Tips — Civitai, 10 model retrospective](https://civitai.com/articles/3701/sdxl-photorealistic-lora-tips-reflections-on-training-and-releasing-10-different-models) — MEDIUM confidence (practitioner, not official docs)
- [Getting the Best Facial Match in LoRA Training — Civitai quick guide](https://civitai.com/articles/16676/quick-guide-getting-the-best-facial-match-in-civitai-lora-training) — MEDIUM confidence
- [Train a Character LoRA from 24 Photos — modl.run](https://modl.run/guides/train-character-lora/) — MEDIUM confidence (current, practical workflow)
- [ArcFace: Additive Angular Margin Loss — insightface.ai](https://www.insightface.ai/research/arcface) — HIGH confidence (official research)
- [Best Platforms for Custom LoRA Models — sozee.ai](https://sozee.ai/resources/custom-lora-models-virtual-avatars/) — LOW confidence (vendor blog; dataset size guidance corroborated by multiple sources)
- [Advanced FLUX Dreambooth LoRA Training — Hugging Face](https://huggingface.co/blog/linoyts/new-advanced-flux-dreambooth-lora) — HIGH confidence (official HuggingFace)
- [LoRA Training Guide — zsky.ai](https://zsky.ai/blog/lora-training-guide) — LOW confidence (vendor blog; dataset and curation advice corroborated elsewhere)
- [Training SDXL LoRA with AI Toolkit — comfyui.nomadoor.net](https://comfyui.nomadoor.net/en/notes/ai-toolkit-sdxl-lora-training/) — MEDIUM confidence
- [LoRA Training Parameters Guide (Illustrious) — Civitai](https://civitai.com/articles/21257/lora-training-parameters-guide-for-sdxl-illustrious-civitai-on-site-trainer) — MEDIUM confidence

---

*Feature research for: visual-identity-engine LoRA likeness spike*
*Researched: 2026-06-01*
