# Requirements — Workstream: visual-identity-engine

**Milestone:** v1.0 — Visual Identity Engine: LoRA Likeness Spike
**Type:** De-risking R&D spike (no fan-facing surface, no production infra)
**Defined:** 2026-06-01
**Source:** `.planning/workstreams/visual-identity-engine/research/SUMMARY.md`

## Goal

Prove a LoRA-based image-generation pipeline can produce convincing on-model images of creator Claire's photographic likeness, ending in a founder eval gallery + findings doc with a **go/no-go** verdict on productionizing image generation. Outputs stay founder-internal this milestone.

**Settled stack (from research):** FLUX.1 [dev] + DreamBooth-LoRA, run via a hosted GPU API (Replicate primary / RunPod·Modal fallback). Illustrious XL is rejected as anime-leaning. GMI Cloud has no usable public image API — this milestone **amends the single-provider mandate** for image only.

---

## v1.0 Requirements

### GATE — Pre-spike legal & ops prerequisites
> The founder deferred the *full* content policy. Research established consent + minimum guardrails as legal exposure under the TAKE IT DOWN Act (full enforcement 2026-05-19) and CA SB 683 (digital-replica right-of-publicity).

- [ ] **GATE-01** *(founder-accepted risk — NOT a blocker for the founder-internal spike)*: Founder has elected to treat Claire's existing twin/voice consent as sufficient to begin the **founder-internal** spike, accepting the residual risk that it does not explicitly cover image-model training. **A signed image-generation consent addendum becomes a HARD blocker before any spike output (image or `.safetensors`) leaves founder-internal scope** — this gates the future "go → productionize" milestone, not this one.
- [ ] **GATE-02**: Chosen provider's ToS is checked on three points and recorded: (a) they do not train on / retain uploaded photos beyond the job, (b) trained `.safetensors` weights are downloadable/exportable, (c) deletion procedure exists
- [ ] **GATE-03**: Written go/no-go criteria and a Definition of Done exist before any GPU spend (so evaluation is not gut-feel after the fact)
- [ ] **GATE-04**: Minimum guardrails recorded as binding for this spike: SFW-only generation, founder-internal outputs only, no sharing of the LoRA file, access-controlled output storage

### DATA — Dataset curation & preprocessing
- [ ] **DATA-01**: Curate 20–30 of Claire's photos against a documented variety checklist (4+ angles, 3+ lighting contexts, 2+ outfits), with a rejection log
- [ ] **DATA-02**: Preprocess images (resize/crop to training resolution) into a training-ready dataset folder
- [ ] **DATA-03**: Caption images **manually** (pose / lighting / background only — no facial-appearance descriptors) bound to a single trigger word, to avoid identity bleed

### TRAIN — LoRA training & weights archival
- [ ] **TRAIN-01**: Run FLUX.1-dev DreamBooth-LoRA training via the provider **API path** (not web UI), with a saved config/manifest for reproducibility (seeds, steps, dataset hash)
- [ ] **TRAIN-02**: Cost controls in place before first run: spend alert + auto-stop / no idle GPU billing
- [ ] **TRAIN-03**: Download the resulting `.safetensors` weights to lala.la-controlled storage and delete training photos from the vendor within 24h of completion (creator-owns-her-LoRA guarantee + data minimization)

### EVAL — Eval gallery generation & structured review
- [ ] **EVAL-01**: Generate a structured eval gallery — a LoRA-strength grid (e.g. 0.6 / 0.75 / 0.85 / 1.0) × fixed seeds × varied neutral prompts (portrait, half-body, full-body, candid), with strength encoded in filenames
- [ ] **EVAL-02**: Run an overfit / "same-face" bleed check (LoRA active, no trigger word) and a prompt-flexibility check (outfit/scene/expression variation)
- [ ] **EVAL-03**: Founder scores the gallery against the pre-defined criteria (likeness recognition rate, diversity, SFW compliance, artifact rate, reproducibility)

### DOC — Findings & verdict
- [ ] **DOC-01**: Write a findings doc capturing chosen provider/model, cost-per-image, training time/cost, likeness verdict, and known limitations
- [ ] **DOC-02**: Record an explicit **go/no-go** decision on productionizing image gen, with the production seam noted (IImageProvider in `lib/providers`, BullMQ job like voice) but **not built**

---

## Future Requirements (deferred — only if "go")

- Production `IImageProvider` interface + concrete provider impl in `lib/providers` (mirrors `IVoiceProvider`)
- BullMQ `loraTrainingQueue` + `imageGenQueue` handlers in `artifacts/worker`; DB migration for LoRA/image assets
- Fan-facing delivery into web chat + Telegram fan-twin, with output moderation (image moderation layer)
- **Full content policy**: NSFW/suggestive tiers, age-gating, fan-facing distribution rules, brand review, per-locale compliance
- Generalized, repeatable training runbook for creators #2..N
- Reassess RunPod/Modal vs Replicate at volume (creator #5+); revisit GMI image API

## Out of Scope (this milestone)

- Any fan-facing image delivery or storage pipeline — founder-internal only
- Production serving / on-demand generation infrastructure
- Image moderation provider integration
- Full content/NSFW policy and age-gating (deferred — distinct from the non-deferrable GATE guardrails above)
- Multi-creator generalization — Claire only
- Video generation (separate roadmap initiative)

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| GATE-01 | Phase 1 — Legal and Ops Gates | Pending |
| GATE-02 | Phase 1 — Legal and Ops Gates | Pending |
| GATE-03 | Phase 1 — Legal and Ops Gates | Pending |
| GATE-04 | Phase 1 — Legal and Ops Gates | Pending |
| DATA-01 | Phase 2 — Dataset Curation and Preprocessing | Pending |
| DATA-02 | Phase 2 — Dataset Curation and Preprocessing | Pending |
| DATA-03 | Phase 2 — Dataset Curation and Preprocessing | Pending |
| TRAIN-01 | Phase 3 — Training Run and Weights Archival | Pending |
| TRAIN-02 | Phase 3 — Training Run and Weights Archival | Pending |
| TRAIN-03 | Phase 3 — Training Run and Weights Archival | Pending |
| EVAL-01 | Phase 4 — Eval Gallery Generation and Founder Review | Pending |
| EVAL-02 | Phase 4 — Eval Gallery Generation and Founder Review | Pending |
| EVAL-03 | Phase 4 — Eval Gallery Generation and Founder Review | Pending |
| DOC-01 | Phase 5 — Findings Documentation and Go/No-Go Verdict | Pending |
| DOC-02 | Phase 5 — Findings Documentation and Go/No-Go Verdict | Pending |
