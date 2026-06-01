---
gsd_state_version: 1.0
workstream: visual-identity-engine
milestone: v1.0
milestone_name: Visual Identity Engine — LoRA Likeness Spike
current_phase: 1
current_plan: N/A
status: not_started
stopped_at: N/A
last_updated: "2026-06-01"
last_activity: 2026-06-01
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Workstream State — visual-identity-engine

## Current Position

**Status:** Ready to execute — roadmap created, no phases started
**Current Phase:** Phase 1 — Legal and Ops Gates
**Last Activity:** 2026-06-01
**Last Activity Description:** Roadmap created (5 phases, 14 requirements mapped)

## Progress

**Phases Complete:** 0 / 5
**Current Plan:** N/A

```
[          ] Phase 1: Legal and Ops Gates
[          ] Phase 2: Dataset Curation and Preprocessing
[          ] Phase 3: Training Run and Weights Archival
[          ] Phase 4: Eval Gallery Generation and Founder Review
[          ] Phase 5: Findings Documentation and Go/No-Go Verdict
```

## Accumulated Context

### Decisions
- FLUX.1 [dev] + DreamBooth-LoRA is the settled stack (Illustrious XL rejected — anime-specialized)
- Replicate API path is primary provider; fal.ai portrait trainer is fallback if Replicate likeness disappoints after 2–3 runs
- Spike code lives in `spikes/lora-spike/` — outside `pnpm-workspace.yaml`, zero changes to production monorepo
- All outputs are founder-internal; no fan-facing surface this milestone
- Provider single-mandate is amended for image only (GMI has no confirmed public image API)

### Critical Blockers to Watch
- Phase 1 must fully clear before any photo upload or GPU spend — legally non-negotiable
- GATE-01 risk note: Claire's existing consent does not cover LoRA training; consent addendum is a hard blocker before any spike output leaves founder-internal scope
- Replicate: use API path only (not web UI) — web UI predictions are retained indefinitely

### Todos
- (none yet — awaiting Phase 1 execution)

## Session Continuity

**Stopped At:** N/A
**Resume File:** None
**Next Action:** Start Phase 1 — record GATE-01 risk acceptance, review Replicate ToS in writing, write go/no-go criteria, record four spike guardrails
