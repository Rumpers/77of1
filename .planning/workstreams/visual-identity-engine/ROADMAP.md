# Roadmap — Workstream: visual-identity-engine

**Milestone:** v1.0 — Visual Identity Engine: LoRA Likeness Spike
**Type:** De-risking R&D spike
**Granularity:** Coarse (5 phases — each phase is a legally or technically non-mergeable delivery boundary)
**Coverage:** 14/14 requirements mapped
**Created:** 2026-06-01

---

## Phases

- [ ] **Phase 1: Legal and Ops Gates** — All legal prerequisites and operational guardrails are locked in writing before any photo is uploaded or GPU spend occurs
- [ ] **Phase 2: Dataset Curation and Preprocessing** — A training-ready, diversity-verified dataset of Claire's photos exists with per-image caption files that protect identity learning
- [ ] **Phase 3: Training Run and Weights Archival** — A trained FLUX.1 [dev] DreamBooth-LoRA `.safetensors` file is downloaded to lala.la-controlled storage and training photos are deleted from the vendor
- [ ] **Phase 4: Eval Gallery Generation and Founder Review** — A structured eval gallery of ~24 images exists and the founder has scored it against pre-defined criteria
- [ ] **Phase 5: Findings Documentation and Go/No-Go Verdict** — A findings doc exists with a written go/no-go decision and the production seam is documented (not built)

---

## Phase Details

### Phase 1: Legal and Ops Gates
**Goal**: All legal prerequisites and operational guardrails are locked in writing before any photo is uploaded or GPU spend occurs
**Depends on**: Nothing (first phase)
**Requirements**: GATE-01, GATE-02, GATE-03, GATE-04
**Success Criteria** (what must be TRUE):
  1. A written note exists confirming GATE-01 founder-accepted risk: Claire's existing consent is treated as sufficient for the founder-internal spike, with the explicit acknowledgment that a signed image-generation consent addendum is a hard blocker before any spike output leaves founder-internal scope
  2. Chosen provider (Replicate) ToS is reviewed and three answers are recorded in writing: (a) training photos via API path are deleted after 1 hour, (b) `.safetensors` weights are downloadable, (c) a deletion procedure exists
  3. Written go/no-go criteria and a Definition of Done exist before any GPU spend — criteria include face recognition threshold (≥7/10 founder recognitions in gallery), diversity, SFW compliance, artifact rate, and reproducibility
  4. Four minimum guardrails are recorded as binding for this spike: SFW-only generation, founder-internal outputs only, no LoRA file sharing, access-controlled output storage in a private Replit Object Storage bucket
**Plans**: TBD

### Phase 2: Dataset Curation and Preprocessing
**Goal**: A training-ready, diversity-verified dataset of Claire's photos exists with per-image caption files that protect identity learning
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. A curated set of 20–30 Claire photos exists with a documented variety checklist confirming 4+ angles, 3+ lighting contexts, and 2+ outfits covered, plus a rejection log for photos that did not make the cut
  2. All selected photos are preprocessed and resized to training resolution (1024×1024) in a training-ready folder
  3. Every image has a corresponding caption file that uses the trigger word, describes only pose / lighting / background, and contains zero facial-appearance descriptors (no hair color, eye color, or facial-structure terms)
**Plans**: TBD

### Phase 3: Training Run and Weights Archival
**Goal**: A trained FLUX.1 [dev] DreamBooth-LoRA `.safetensors` file is downloaded to lala.la-controlled storage and training photos are deleted from the vendor
**Depends on**: Phase 2
**Requirements**: TRAIN-01, TRAIN-02, TRAIN-03
**Success Criteria** (what must be TRUE):
  1. A DreamBooth-LoRA training run has been submitted and completed via the Replicate API path (not web UI), and a saved config/manifest file records the run's seeds, step count, and dataset hash for reproducibility
  2. A spend alert and auto-stop control were in place before the first run (no idle GPU billing possible)
  3. The resulting `.safetensors` weights file is downloaded to `creators/{creator_id}/lora_weights/{version}.safetensors` in lala.la-controlled storage (Replit Object Storage or local encrypted folder)
  4. Training photos have been deleted from Replicate within 24 hours of training completion, with a deletion confirmation noted
**Plans**: TBD

### Phase 4: Eval Gallery Generation and Founder Review
**Goal**: A structured eval gallery of ~24 images exists and the founder has scored it against pre-defined criteria
**Depends on**: Phase 3
**Requirements**: EVAL-01, EVAL-02, EVAL-03
**Success Criteria** (what must be TRUE):
  1. An eval gallery exists with images generated across a LoRA-strength grid (0.6 / 0.75 / 0.85 / 1.0) × fixed seeds × varied neutral prompts (portrait, half-body, full-body, candid), with LoRA strength and prompt type encoded in filenames
  2. An overfit / "same-face" bleed check has been run (LoRA active, no trigger word, 5+ images) and a prompt-flexibility check has been run (outfit / scene / expression variation across images)
  3. The founder has scored the gallery against the pre-defined go/no-go criteria from Phase 1: face recognition rate, scene diversity, SFW compliance, artifact rate, and reproducibility — with each criterion given an explicit pass/fail or numeric score
**Plans**: TBD

### Phase 5: Findings Documentation and Go/No-Go Verdict
**Goal**: A findings doc exists with a written go/no-go decision and the production seam is documented (not built)
**Depends on**: Phase 4
**Requirements**: DOC-01, DOC-02
**Success Criteria** (what must be TRUE):
  1. A findings document exists capturing: chosen provider and model, cost per training run and per image, training time, Phase 4 likeness verdict (pass rate against pre-defined criteria), optimal LoRA strength, and known limitations
  2. An explicit written go/no-go decision on productionizing image generation exists — either "go: proceed to production IImageProvider" or "no-go: reason and alternatives"
  3. If verdict is "go", the production seam is documented in the findings doc: `IImageProvider` interface in `lib/providers`, `loraTrainingQueue` + `imageGenQueue` in `lib/queue`, worker handlers in `artifacts/worker`, and `016_lora_assets.sql` migration — with a note that none of these are built during the spike
**Plans**: TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Legal and Ops Gates | 0/0 | Not started | - |
| 2. Dataset Curation and Preprocessing | 0/0 | Not started | - |
| 3. Training Run and Weights Archival | 0/0 | Not started | - |
| 4. Eval Gallery Generation and Founder Review | 0/0 | Not started | - |
| 5. Findings Documentation and Go/No-Go Verdict | 0/0 | Not started | - |
