# 7of1 — North Star

*One-screen summary of the agency pivot. If this conflicts with `PRD.md`, this wins until the PRD is rewritten.*

## What we are

**7of1 is an AI-native creator-ops agency.** Influencers send us raw material (DM screenshots, voice notes, selfies); we build, run, and evolve a digital twin of them in their voice; we deploy that twin onto whatever monetization platform they already use (Fanvue, Patreon, Telegram paid channels, Discord paid roles, their own site, etc.). We never run the fan-payment loop. We take a rev-share on the revenue our twin attributably drives.

## What we are not

- Not a fan marketplace. Fans don't pay 7of1; they pay the host platform.
- Not a self-serve SaaS. We *operate* the twin for the creator; AI does most of the labor, with thin human leverage.
- Not an OnlyFans / Fanvue competitor. We ride on top of those platforms, not against them.

## The 11 decisions

1. **Customer = creator** (not fan). Creator pays via rev-share.
2. **Pure rev-share** — target 25-30% of revenue attributable to twin-driven conversions on host platforms. Higher tier (40-50%, OF-style) on the table once attribution is proven.
3. **Lala** is the creator's single AI manager. One personality, one relationship. Internally she delegates to 5 background agents (Intake, Content Producer, Distribution, Attribution, Supervisor) — invisible to the creator.
4. **The Twin** is separate from Lala. Lala is universal across all creators; the Twin *is* the creator (her voice, her style, her brand).
5. **Multi-twin per creator** is allowed by design (e.g., public twin + hidden private twin, or per-region twins).
6. **Twin has a constitution** — core values + hard limits, evolvable with creator approval. Replaces the PRD's "intensity dial" abstraction.
7. **Telegram-first** for both Lala (creator side) and Twin (fan side). LINE Official Account follows for JP/TW launch. WhatsApp / Messenger later.
8. **EN-first for iteration; JP + ZH-TW required by launch.** Twin engine is language-agnostic; voice quality for JP/TW is the wildcard.
9. **Fan-name masking on-device** before any DM screenshot is uploaded. Solves the third-party consent problem at the upload layer, not the legal layer.
10. **First fan-facing surfaces:** Telegram fan-twin bot + funnel page on `7of1.tld/[handle]` (free chat → CTA to *her* monetization, with `conversation_id` carried through for attribution).
11. **No fan payment loop, ever.** Resolves the PRD §8.10 vs §5.6 retraction contradiction (host platform owns content delivery and retraction).

## Lala's voice

**Lala is the creator's cheerleader with operational competence.** Warm, encouraging, celebrates wins out loud, gentle on setbacks, always in her corner. Less "executive assistant," more "the friend who's hyping her up and also handling her business."

In ZH-TW copy, Lala's name is canonically **啦啦** (cheerleading) — *not* 拉拉. Tilt readers toward the cheerleader meaning by owning it in copy. In JP, ララ. In EN, Lala.

Voice rules of thumb:
- "✅ Done!" → "✅ Yes! Got it 🎉"
- "Your twin is ready" → "She's ready and she sounds amazing 💫"
- "Processing failed" → "Hmm, that one didn't go through — want me to try again?"

## What this dissolves

Roughly a third of `docs/hidden-requirements-tickets.md` (~25-35 tickets) is out of scope under this model. Fan auth, credit packs, conbini pending UX, fan KYC, age-gate infrastructure, fan-side DSAR, fan crisis intervention, fan refund engine, conbini pending UX — all host-platform responsibility now. See that doc's "Deferred under Option A" banner.

## What this makes urgent

- **Conversation-credit attribution** from day 1. Every twin response carries a `conversation_id`; every outbound CTA carries it in the UTM; host-platform conversions match against it within a 7-30d window. Without this, "pure rev-share" is just a vibe.
- **Platform connector layer.** Adapters for Patreon (API exists), Telegram Stars (native), Discord paid roles, IG via creator OAuth (start Meta approval now — 6-month lead time).
- **Agent supervisor.** A traditional agency absorbs a bad account manager. An AI-native ops company cannot absorb a runaway agent. Eval / monitoring / circuit-breakers / kill-switches become P0 *operations* infrastructure.

## Build order

Phased build plan: see `/root/.claude/plans/ok-let-s-break-this-breezy-music.md` (also tracked in repo at the next planning cycle).

| Phase | Goal | Time |
|---|---|---|
| 0 | Repositioning (rename, north-star doc, deferred-ticket marking) | 1 wk |
| 1 | Lala MVP + real twin runtime + agent harness stubs | 3-4 wks |
| 2 | Funnel page + Telegram fan-twin + conversation tracking | 2-3 wks |
| 3 | Real background agents (replace founder-as-stub) | 3-4 wks |
| 4 | Multi-twin + creator-side billing | 2 wks |
| 5 | First real creator goes live | overlaps end of Phase 4 |
| 6 | Scale-out (LINE, Patreon connector, IG OAuth, etc.) | post-launch |

## The first creator

A warm-lead influencer DM'd this week: *"Morning! Digital twins is something new to me I really want to try it tho 😳✨"*. She is patient (month+ timeline acceptable). Founder-led onboarding, Lala assists, full legal review before her face/voice is trained on. Use her engagement to harden Phase 1-4 against real friction before opening to creator #2.

---

*Last updated: 2026-05-27. Owner: founder.*
