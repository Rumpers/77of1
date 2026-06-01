# Research Summary: Visual Identity Engine — Image-Gen + LoRA Spike

**Project:** lala.la — visual-identity-engine workstream
**Domain:** Creator-likeness LoRA training R&D spike (photorealistic image generation, founder-internal eval)
**Researched:** 2026-06-01
**Confidence:** HIGH (legal/consent, technical fundamentals, provider APIs); MEDIUM (quality outcomes)

---

## Executive Summary

This workstream is a scoped de-risking spike — not a product build. The deliverable is a founder eval gallery and a findings doc that produces a go/no-go verdict on productionizing image generation for Claire's AI twin. Expert consensus for this use case is clear: DreamBooth-style LoRA on FLUX.1 [dev], 20–30 curated photos, trained via a hosted API (Replicate primary, fal.ai as fallback), producing a ~5MB `.safetensors` weight file. The spike code lives in a throwaway `spikes/lora-spike/` directory with no workspace membership, no server, and zero changes to the production codebase. Estimated cost to first usable eval gallery: $15–25 total (5–10 training iterations at ~$1.46–$2.40 each, plus inference).

The primary risk is not technical — it is legal and consent-related. Two U.S. laws create hard prerequisites that cannot be deferred even though the full content policy can: the TAKE IT DOWN Act (platform enforcement effective May 19, 2026, covers synthetic intimate imagery of real persons) and California SB 683 (signed October 2025, explicitly extends right-of-publicity to digital replicas including trained LoRA weights). Claire's existing consent covers chat AI and voice AI; it does not cover LoRA training or synthetic image generation. A one-paragraph written consent addendum must be signed before any photos are uploaded to any vendor. This is a legal prerequisite with private-right-of-action exposure, not an administrative formality.

The provider selection carries a data-handling tradeoff that intersects directly with consent and creator-ownership guarantees: Replicate has the best developer experience but retains training photos uploaded via its web UI indefinitely (API-path predictions are deleted after one hour). RunPod and Modal offer superior data control but require more setup. The recommendation is to use Replicate's API path for the spike — not the web UI — so the one-hour deletion clock applies to training photos. Download the `.safetensors` file to Replit Object Storage immediately after training so lala.la holds the asset, not the vendor.

---

## Legal Prerequisites vs. Deferred Content Policy

This is the most important distinction in the research. The decision to defer full content policy is correct for the spike scope — but it must not be confused with deferring the minimum non-negotiable guardrails that two active laws require right now.

### Minimum Non-Deferrable Guardrails (Legal Prerequisites)

These must be in place before a single training photo is uploaded or a single inference call is made.

| Guardrail | Legal Basis | What It Requires |
|-----------|-------------|-----------------|
| Written consent addendum covering LoRA training and synthetic image generation | California AB 2602 (eff. 2025): AI replica consent must describe intended uses "with reasonable specificity"; general "AI twin" consent does not cover image generation | One-paragraph addendum signed by Claire before any GPU spend; scope: internal eval only, not for distribution |
| SFW-only inference — no NSFW generation, even for testing | TAKE IT DOWN Act (platform enforcement eff. May 19, 2026): synthetic intimate imagery of real persons is a federal offense; 48-hour removal obligation on platforms | Keep FLUX.1-dev safety filters enabled; prompt-constrain all generations to clothed, non-intimate contexts; SFW is a hard gate, not a prompt-engineering preference |
| Founder-internal outputs only — no distribution | Same as above | All generated images go to a private, access-controlled location (private Replit Object Storage bucket or local encrypted folder); not shared via messaging apps, cloud photo services, or Notion |
| No LoRA file sharing outside founding team | California SB 683 (signed Oct 2025): trained LoRA of Claire's face is a "digital replica" under right-of-publicity law; distribution without consent is a violation | `.safetensors` file treated as a private signing key; stored only where lala.la has exclusive access |
| Vendor data-retention check before upload | Pitfall C4/L4: platforms with "may use to improve services" ToS incorporate creator photos into their own models | Answer three questions in writing before uploading: (1) Can I download the `.safetensors` file? (2) Does ToS say you will not use my uploaded images to train your own models? (3) Can I delete uploaded images after training? |
| `.safetensors` stored under lala.la control | SB 683 / non-exclusive revocable license in PROJECT.md | Download weights to Replit Object Storage under `creators/{creator_id}/lora_weights/{version}.safetensors` immediately after training; do not leave them on provider CDN as sole copy |
| Deletion procedure defined upfront | Creator's right to take back assets (PROJECT.md); SB 683 right of revocation | Define what gets deleted and from where — before the spike starts, not when Claire asks |

### Full Content Policy (Deferred — Correct)

The full content policy (permissible image content for fan-facing distribution, creator approval workflows, brand review, NSFW tiers, age verification for generated imagery) remains deferred to the productionization milestone. This is appropriate: none of it is needed for a founder-internal eval gallery. The only requirement now is that every spike output stays within the non-deferrable guardrails above.

---

## Provider Tradeoff: Replicate vs. RunPod/Modal

| Dimension | Replicate (API path) | RunPod / Modal |
|-----------|---------------------|----------------|
| Developer experience | Excellent — 10-line TypeScript, typed SDK, auto CDN for weights | Manual — requires container setup, training code configuration |
| Training cost | ~$1.46/run (1000 steps, fast-trainer) | ~$2–4/run at H100 serverless rates; more setup overhead |
| Training photo retention | **API predictions deleted after 1 hour. Web UI predictions kept indefinitely.** Use API path only — never the web UI. | Ephemeral by default (Modal serverless); RunPod volumes require explicit deletion but you control when |
| Weights export | `.safetensors` downloadable via `output.weights` URL | Direct access — your container, your storage |
| ToS re: training data | Does not claim rights to user-uploaded training data | Same — raw compute providers do not claim data rights |
| Idle billing risk | None — serverless, billed per second of execution | RunPod persistent pods can be left running (known pitfall); Modal terminates on completion |
| Recommended for | This spike (simplest path to first eval gallery) | Production at scale (creator #5+) or if Replicate ToS changes unfavorably |

**Recommendation: use Replicate's API path for the spike.** Key mitigation: programmatic upload only (not web UI), so training photos fall under the one-hour deletion policy. If the project reaches creator #5+, re-evaluate RunPod/Modal for better per-run economics and data-handling guarantees.

---

## Key Findings

### Recommended Stack

FLUX.1 [dev] is the unambiguous base model for photorealistic person-likeness work in 2025–2026. Illustrious XL — referenced in earlier roadmap notes — is anime/illustration-specialized and will produce illustrated portraits, not photographs. This distinction is well-documented and must be corrected in the roadmap. FLUX.2 [dev] offers genuine improvements but costs 5× more per training step ($8/1k steps on fal.ai vs ~$2.40) with a thinner community track record for portrait LoRAs; defer unless FLUX.1 results fail after 3–5 iterations.

Personalization method is DreamBooth-style LoRA at rank 16–32 via `ostris/ai-toolkit` (the standard FLUX LoRA training library, used by both Replicate and fal.ai under the hood). fal.ai's portrait trainer adds automated subject segmentation and per-face captioning that may produce better identity fidelity for the same cost — making it the recommended fallback if Replicate results disappoint after 2–3 runs.

**Core technologies:**
- **FLUX.1 [dev]** (Black Forest Labs): base model for photorealistic portrait LoRA — industry standard; strong skin/hair/eye fidelity
- **DreamBooth-LoRA rank 16–32**: personalization method — correct technique for face identity; produces exportable ~3–5MB `.safetensors` file
- **Replicate** (`replicate@^1.4.0`): hosted training + inference — ~$1.46/run, ~2 min; mature TypeScript SDK; primary recommendation
- **fal.ai** (`@fal-ai/client@^1.10.1`): portrait-specific trainer fallback — $2.40/1000 steps; auto subject-crop and segmentation; recommended if Replicate likeness disappoints
- **`tsx` CLI** (already in workspace catalog at `^4.21.0`): spike runner — no new tooling dependency
- **JoyCaption / Qwen3-VL**: auto-captioning — describes pose/lighting/background only; appearance descriptors explicitly excluded

**What NOT to use:**
- Illustrious XL — anime-specialized, wrong for photoreal portraits
- GMI Cloud for image generation — no confirmed public REST API found; not a spike-suitable managed endpoint
- Consumer "train your avatar" services (Civitai hosted, Astria, Lensa) — ToS typically claims rights over uploaded training data and locks weights server-side

### Expected Features

The spike is not a product feature build. Its only deliverable is knowledge.

**Must have (table stakes — spike cannot produce a go/no-go without these):**
- Curated dataset of 20–30 Claire photos with documented diversity (3+ lighting conditions, 3+ angles, 2+ clothing items, 3+ background contexts) — single highest-leverage input; uniform selfie set fails regardless of training parameters
- Image preprocessing to 1024×1024 with per-image caption files using trigger word; appearance descriptors excluded from captions
- One training run via Replicate API path, checkpoint saves every 200–500 steps
- Structured prompt grid: LoRA strength sweep (0.6 / 0.8 / 1.0 / 1.2) × 3 scene prompts × 2 checkpoints = ~24 images
- Founder Phase A–D eval: bleed check → identity recognition (7/10 threshold) → flexibility test → checkpoint comparison
- Findings doc: model, cost, training time, Phase B pass rate, optimal LoRA strength, go/no-go verdict against explicit criteria

**Should have (improve findings quality):**
- Bleed check before full eval (5-image test: LoRA active, no trigger word; detects overfit early before wasting eval time)
- Multi-checkpoint comparison (mid vs late training; mid often outperforms late for flexibility)
- ArcFace cosine similarity score (optional; adds reproducible numeric baseline for future creator #2 comparison)

**Explicitly defer (anti-features for this spike):**
- Fan-facing image serving, CDN, or API endpoint
- NSFW generation testing (TAKE IT DOWN Act; SFW-only is a hard gate)
- Real-time on-demand generation
- Multi-creator parallel training, video generation, automated FID/IS scoring

### Architecture Approach

The spike code belongs in `spikes/lora-spike/` at repo root, with a standalone `package.json` not registered in `pnpm-workspace.yaml`. This keeps it entirely outside the Replit artifact system, outside `pnpm run build`, and deletable without trace. Four `tsx` CLI scripts cover the full data flow.

**Major components (spike only):**
1. `spikes/lora-spike/src/upload.ts` — zip training photos, upload to Replicate programmatically, emit training zip URL
2. `spikes/lora-spike/src/train.ts` — POST training job, poll every 30s, write weights URL to `outputs/training-result.json`; download `.safetensors` to Replit Object Storage on completion
3. `spikes/lora-spike/src/generate.ts` — load weights URL, run prompt grid with polling, download images to `outputs/gallery/`
4. `spikes/lora-spike/src/gallery.ts` — write `outputs/gallery/manifest.json` for founder review

**Production seam (note now, build after go verdict only):**
- `lib/providers` gets `IImageProvider` interface mirroring `IVoiceProvider` exactly
- `lib/queue` gets `loraTrainingQueue` + `imageGenQueue` BullMQ definitions
- `artifacts/worker` gets two handlers mirroring voice async job pattern
- `lib/db/src/migrations/016_lora_assets.sql` adds `lora_versions` + `generated_images` tables
- Zero changes to `lib/twin-runtime`, `artifacts/api-server`, or any existing service during the spike

### Critical Pitfalls

1. **Wrong base model (Illustrious XL)** — Illustrious produces anime-stylized portraits on real people; must use FLUX.1 [dev] for photorealistic likeness. Decision must be locked before the first run, not after seeing bad results. (Pitfall T4)

2. **Auto-captioning breaking identity learning** — Standard auto-captioners write the subject's hair color, eye color, and facial structure into captions. The model then explains those features via text rather than binding them to the trigger word, so the face is generic. Strip all appearance descriptors from captions; describe only pose, lighting, and background. (Pitfall T3)

3. **Overfitting / same-face collapse** — Too many steps or a low-diversity dataset produces a LoRA that generates one photocopy of one training frame. Cap at 10 epochs for first pass; require dataset diversity across 3+ lighting conditions, 3+ angles, 2+ clothing items before authorizing GPU spend; generate samples every 200–300 steps to catch collapse early. (Pitfalls T1, T2)

4. **LoRA strength miscalibration** — Evaluating with default strength (1.0) misrepresents model quality and produces plastic-skin artifacts. Always run a 4-point strength grid (0.6 / 0.75 / 0.85 / 1.0) and record the optimal value. (Pitfall T5)

5. **No consent addendum before training** — Claire's existing consent does not cover LoRA training or synthetic image generation. California AB 2602 requires "reasonably specific" AI replica consent. Training without this signed addendum creates legal exposure with no mitigation. Hard prerequisite, not a checklist item. (Pitfall L1)

---

## Implications for Roadmap

Suggested phase structure:

### Phase 1: Pre-Spike Legal and Ops Gates
**Rationale:** Legally blocking prerequisites; cannot be done in parallel with or after Phase 2. No GPU spend until these are cleared.
**Delivers:** Signed consent addendum (LoRA training + synthetic image generation, internal eval scope only); vendor three-question ToS review in writing; Replit Object Storage destination for `.safetensors` confirmed; deletion procedure written; go/no-go criteria written and locked before training starts
**Avoids:** TAKE IT DOWN Act / SB 683 / AB 2602 exposure; creator photo data on bad-ToS vendor; non-exportable weights
**Research flag:** No additional research needed — checklist is fully specified

### Phase 2: Dataset Curation and Preprocessing
**Rationale:** Dataset quality determines LoRA quality; all GPU spend is wasted if this is wrong. Cheapest phase to get right.
**Delivers:** 20–30 curated Claire photos with documented coverage; all preprocessed to 1024×1024; per-image caption files with trigger word and no appearance descriptors
**Avoids:** Same-face collapse, wardrobe bleed, caption-broken identity learning
**Research flag:** No additional research needed

### Phase 3: Training Run and Weights Archival
**Rationale:** First GPU spend after gates and dataset are confirmed. Use Replicate API path.
**Delivers:** LoRA `.safetensors` file; mid-training sample images at checkpoints; weights downloaded to Replit Object Storage immediately on completion; training photos deleted from Replicate within 24h
**Avoids:** Photo data retention on vendor, vendor lock-in on weights, idle GPU billing
**Research flag:** No additional research needed — API flow fully specified; if Replicate likeness disappoints after 2 iterations, switch to fal.ai portrait trainer (no re-research needed, SDK is parallel)

### Phase 4: Eval Gallery Generation and Structured Founder Review
**Rationale:** Structured evaluation with defined criteria produces a defensible verdict, not gut feel.
**Delivers:** ~24-image eval gallery; Phase A–D eval results; optimal LoRA strength identified; go/no-go criteria graded explicitly (face recognition 15/20, diversity 3+ contexts, SFW 20/20, artifacts <50%, reproducibility confirmed)
**Research flag:** No additional research needed

### Phase 5: Findings Documentation and Go/No-Go Verdict
**Rationale:** The `.safetensors` file with no documentation produces zero knowledge for the roadmap. The findings doc is the primary output.
**Delivers:** Five-section findings doc (dataset, training, inference, results, roadmap decisions); go/no-go verdict; if go — production provider recommendation and base model version for productionization planning
**Research flag:** If verdict is GO, the production seam (IImageProvider, BullMQ queues, DB migration 016) is ready to plan without additional external research — pattern fully specified in ARCHITECTURE.md

### Phase Ordering Rationale

- Phase 1 gates everything because it is legally blocking; there is no safe way to start photo upload before consent is signed and vendor ToS reviewed
- Phase 2 before any GPU spend because dataset quality determines LoRA quality; fixing a bad dataset requires a full re-run ($1.46+ wasted)
- Phase 3 can iterate (second training run if Phase B < 7/10) before Phase 4 completes its full eval, but the bleed check (Phase A) gates the full gallery review
- Phase 5 must close before any productionization planning begins; the roadmap milestone must not proceed on "yeah it looks good"

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack (base model, provider, SDK) | HIGH | FLUX.1 dev recommendation consistent across multiple independent sources; Replicate and fal.ai pricing verified against official docs; npm versions confirmed |
| Features (spike workflow, eval protocol) | HIGH | Step-by-step workflow corroborated by practitioner guides and official hosted-training docs; eval protocol has defined pass thresholds |
| Architecture (spike layout, production seam) | HIGH | Spike placement in `spikes/` verified against actual `pnpm-workspace.yaml` and Replit artifact constraints; production seam read directly from `lib/providers` interfaces |
| Legal prerequisites (TAKE IT DOWN, SB 683, AB 2602) | HIGH | All three laws verified against legal analysis sources; effective dates confirmed; platform enforcement date May 19, 2026 is current |
| Pitfalls (technical quality, ops, legal) | HIGH for legal and cost; MEDIUM for quality outcomes | Technical pitfalls corroborated by practitioner community; actual LoRA quality for Claire's specific photos can only be confirmed by running the spike |
| GMI Cloud image capability | LOW | FLUX model names appear in GMI docs catalog but no confirmed public REST endpoint found; not recommended |
| FLUX.2 dev quality vs FLUX.1 for portraits | MEDIUM | Architectural improvements are real; limited head-to-head LoRA portrait comparisons; defer until FLUX.1 results are known |

**Overall confidence:** HIGH for the spike plan; MEDIUM for quality outcome predictions (dependent on Claire's specific photos and training results)

### Gaps to Address

- **FLUX.1 vs FLUX.2 quality for Claire's look:** Cannot be resolved by research; only by Phase 3 results. If Phase B pass rate is below 7/10 after 2–3 Replicate iterations, switch to fal.ai portrait trainer and/or FLUX.2 before calling no-go.
- **fal.ai portrait trainer identity quality vs Replicate:** fal.ai's automated segmentation may outperform Replicate's generic trainer for person likeness; the only way to know is a parallel or fallback run.
- **Replicate ToS stability:** Current ToS does not claim rights over uploaded training data; re-confirm at time of use.
- **GMI Cloud image API:** Warrants a dedicated investigation at creator #5+ for cost optimization at scale; out of scope for the spike.

---

## Sources

### Primary (HIGH confidence)
- `lib/providers/src/providers/interfaces.ts`, `registry.ts`, `mocks.ts` — production provider pattern for IImageProvider seam design (direct codebase read)
- `.planning/PROJECT.md` — non-exclusive license, creator asset ownership, no-GPU Replit constraint
- [Replicate: Fine-tune FLUX.1 with your own images](https://replicate.com/blog/fine-tune-flux) — dataset requirements, training flow
- [Replicate: Faster, cheaper Flux training changelog (2025-05-23)](https://replicate.com/changelog/2025-05-23-faster-flux-trainer) — ~2 min, under $2
- [Replicate pricing](https://replicate.com/pricing) — $0.025/image, ~$1.46/training run
- [Replicate: Data Retention Policy](https://replicate.com/docs/topics/predictions/data-retention) — API predictions deleted after 1 hour; web UI kept indefinitely
- [fal.ai: flux-lora-portrait-trainer](https://fal.ai/models/fal-ai/flux-lora-portrait-trainer/api) — $0.0024/step, portrait-specific, auto segmentation
- [fal.ai: flux-lora-fast-training](https://fal.ai/models/fal-ai/flux-lora-fast-training) — $2/run flat
- [fal.ai: FLUX.2 dev Trainer](https://fal.ai/models/fal-ai/flux-2-trainer) — $0.008/step, 5× cost vs FLUX.1
- [HuggingFace: Advanced FLUX DreamBooth LoRA Training](https://huggingface.co/blog/linoyts/new-advanced-flux-dreambooth-lora) — DreamBooth-LoRA method
- [TAKE IT DOWN Act — Proskauer](https://www.proskauer.com/blog/take-it-down-act-signed-into-law-offering-tools-to-fight-non-consensual-intimate-images-and-creating-a-new-image-takedown-mechanism) — signed May 19, 2025; platform enforcement May 19, 2026; synthetic imagery covered; 48-hour removal obligation
- [TAKE IT DOWN Act — Wikipedia](https://en.wikipedia.org/wiki/TAKE_IT_DOWN_Act) — confirmed effective dates
- [California SB 683 + AB 2602 — Fenwick](https://www.fenwick.com/insights/publications/californias-new-ai-laws-limit-uses-of-digital-likeness) — digital replica right-of-publicity; "reasonably specific" consent requirement
- [AB 2602 consent requirements — Pryor Cashman](https://www.pryorcashman.com/publications/californias-new-ai-laws-what-content-creators-and-ip-owners-need-to-know) — performer consent specificity standard
- [RunPod — Cloud GPU Mistakes to Avoid](https://www.runpod.io/articles/guides/cloud-gpu-mistakes-to-avoid) — idle billing, auto-stop
- [ostris/ai-toolkit GitHub](https://github.com/ostris/ai-toolkit) — underlying training library for both Replicate and fal.ai
- [replicate npm](https://www.npmjs.com/package/replicate) — v1.4.0, TypeScript types, ESM
- [@fal-ai/client npm](https://www.npmjs.com/package/@fal-ai/client) — v1.10.1, published June 2026

### Secondary (MEDIUM confidence)
- [Pelayo Arbues: Training a Personal LoRA on Replicate Using FLUX.1-dev](https://www.pelayoarbues.com/notes/Training-a-Personal-LoRA-on-Replicate-Using-FLUX.1-dev) — real-person likeness walkthrough
- [SeaArt: Illustrious Model Series Guide](https://www.seaart.ai/articleDetail/ctuib45e878c73ekrc90) — confirms Illustrious is anime-specialized
- [FLUX.1 LoRA Not Learning Identity — AI Q&A Hub](https://www.aiqnahub.com/ux-1-lora-not-learning-character/) — auto-captioning breaking identity learning
- [sandner.art — Training Custom LoRA Models](https://sandner.art/ai-for-designers-training-custom-lora-models/) — config save, seed logging, checkpoint practice
- [buildmvpfast.com — Scale-to-Zero Serverless GPUs: Modal vs RunPod vs Replicate](https://www.buildmvpfast.com/blog/scale-to-zero-serverless-gpu-modal-runpod-ai-hosting-2026) — cost comparison, billing model
- Community practitioner sources (Civitai): dataset diversity, checkpoint comparison, strength grid practices

### Tertiary (LOW confidence)
- [GMI Cloud docs: image model quickstarts](https://docs.gmicloud.ai/model-quickstarts/image/overview) — FLUX models listed in catalog but no confirmed public REST endpoint; not recommended for spike

---
*Research completed: 2026-06-01*
*Ready for roadmap: yes*
