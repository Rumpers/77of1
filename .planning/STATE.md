---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Marketing Site
status: executing
stopped_at: "Design system locked (DESIGN.md) + Phase 5 --mkt-* tokens retrofitted (quick 260601-f4l). Next: /gsd-ui-phase 6 → /gsd-plan-phase 6"
last_updated: "2026-06-01T08:37:52.550Z"
last_activity: 2026-06-01 -- Phase 06 execution started
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 7
  completed_plans: 3
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-27)

**Core value:** A fan can open Telegram or `lala.la/[handle]`, have a convincing conversation with a creator's AI twin, and get nudged to her actual monetization platform — all within 30 seconds of first message.
**Current focus:** Phase 06 — marketing-components-navigation

## Current Position

Phase: 06 (marketing-components-navigation) — EXECUTING
Plan: 1 of 4
Status: Executing Phase 06
Last activity: 2026-06-01 -- Phase 06 execution started

```
v2.0 progress: [          ] 0% (0/3 phases)
Phase 5: [ ] Not started
Phase 6: [ ] Not started
Phase 7: [ ] Not started
```

## Performance Metrics

**Velocity:**

- Total plans completed: 9
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | - | - |
| 05 | 3 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 04 P01 | 366s | 3 tasks | 13 files |
| Phase 04 P04-02 | 720 | 3 tasks | 9 files |
| Phase 04 P04-03 | 1500 | 3 tasks | 8 files |
| Phase 04 P04-04 | 1500 | 3 tasks | 14 files |
| Phase 03 P07 | 1070 | 4 tasks | 16 files |
| Phase 03 P03-08 | 590 | 2 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Supabase → Replit PG migration is the first order of business (INFRA-01–04)
- KYC gate (COMPLY-01, KYC-01) is a legal hard gate — twin chat must never pass without `status = 'signed'`
- GMI XTTS endpoint URL unconfirmed — Phase 3 voice work is blocked until GMI credentials are resolved
- CHAT-06 async Telegram ack must be built correctly in Phase 2; retrofitting is expensive
- [Phase ?]: 04-02: Inline moderator factory in runner.ts avoids api-server circular dep; DB push requires live DATABASE_URL on Replit
- [Phase ?]: founderAuth per-route; timingSafeEqual admin token; lazy @workspace/eval import in activate route
- [v2.0]: All marketing work is frontend-only — artifacts/web only; no backend/API changes, no port changes
- [v2.0]: CSS isolation via [data-surface="marketing"] / --mkt-* tokens is mandatory before any component work
- [v2.0]: SEO approach is static index.html + public/ assets only — no Express bot-detect middleware (deferred)
- [v2.0]: i18n approach is extend lib/i18n.ts marketing namespace — do NOT install i18next
- [v2.0]: Noto Sans JP self-hosted via @fontsource-variable; font-display: swap + preload mandatory

### Pending Todos

None yet.

### Blockers/Concerns

- **Phase 3 blocker (v1.0)**: GMI Cloud XTTS endpoint URL unconfirmed — resolve before Phase 3 begins
- **Legal gate (v1.0)**: COMPLY-01 (SB 243 AI disclosure) and COMPLY-02 (crisis helpline injection) must be live before any fan-facing twin is accessible
- **v2.0 Phase 6 ops dependency**: Native-speaker copywriting for JA/ZH-TW needed before Phase 7 copy lock — plan a review round during Phase 6
- **v2.0 Phase 6 ops dependency**: Claire marketing-use authorization (separate from twin operation consent) required before any creator asset appears on the marketing page

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2.0 SEO | Express bot-detect OG-injection middleware | Deferred to v2.x | Phase 5 — static index.html covers use case |
| v2.0 marketing | Social-proof testimonial block | Deferred to v2.x | Needs Claire marketing authorization |
| v2.0 marketing | Creator-ownership callout section | Deferred to v2.x | Kept lean for v2.0 |
| v2.0 marketing | Safety one-liner ("30-case review") section | Deferred to v2.x | Kept lean for v2.0 |

## Quick Tasks Completed

| Quick ID | Description | Date | Commits |
|----------|-------------|------|---------|
| 20260530-claire-persona-direction | twins.direction column + buildSystemPrompt steering + placeholder Claire persona + seed script | 2026-05-30 | 0d92b29, b74dbe8, 9f2f9fc |
| 260601-f4l | Retrofit marketing --mkt-* tokens to DESIGN.md "Luminous Infrastructure" + self-host Bricolage Grotesque / Geist / Noto Sans TC | 2026-06-01 | c01695d, 1c1c878 |

## Session Continuity

Last session: 2026-06-01T02:53:30.876Z
Stopped at: Design system locked (DESIGN.md) + Phase 5 --mkt-* tokens retrofitted (quick 260601-f4l). Next: /gsd-ui-phase 6 → /gsd-plan-phase 6
Resume file: None
