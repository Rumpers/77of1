# Fan Surfaces — Breakdown for Paperclip

The **Fan Surfaces** block (was "Phase 2" in pre-rename plan) builds the fan-facing surfaces — the web funnel at `lala.la/[handle]` and Claire's per-creator Telegram fan-twin bot — and lays down the **conversation-credit attribution spine** that makes rev-share billing possible.

Tickets are sized for 1-3 day PRs. Paste-ready for Paperclip → OF-* assignment.

**Scope rule (recap):** layer on existing code. Don't delete the dormant Stripe / credits / paywall scaffolding; just don't render or extend it.

**Architectural commitment:** **per-creator fan-twin bots** (e.g. `@claire_ai_bot`). At N=1 (Claire), we hardcode her bot's env-var token. At N≥2 we add a `creator_bots` table — explicitly deferred until then.

---

## Conversation Tracking (foundational — must land first)

### [FS-01] Migration — `conversation_id` on `generation_jobs` + new `conversation_history` table

**Why:** Conversation-credit attribution (HID-074) is the spine of rev-share billing. Without a stable `conversation_id` per fan-twin thread, we can't link a Patreon sub event back to "this fan chatted with the twin N times before subscribing." Every Fan Surfaces ticket downstream depends on this.

**Scope:**
- New migration `lib/db/src/migrations/[next]_conversation_tracking.sql`.
- Add nullable `conversation_id UUID` column to `generation_jobs` (per OF-98).
- Create new table `conversation_history`:
  - `id UUID PK, conversation_id UUID NOT NULL, creator_id UUID FK, fan_id UUID NULL, surface TEXT CHECK (surface IN ('web','telegram','widget','ig')), role TEXT CHECK (role IN ('fan','twin')), content TEXT, created_at TIMESTAMPTZ DEFAULT NOW(), model_id TEXT, cost_usd NUMERIC(10,6) NULL`.
  - Indexes: `(conversation_id, created_at)`, `(creator_id, fan_id, created_at)`.
- RLS policies mirroring `generation_jobs` from OF-99.
- Drizzle TS types added.

**Acceptance:**
- [ ] Migration applies cleanly to a fresh DB.
- [ ] Insert + query from the new table via Drizzle works.
- [ ] RLS prevents cross-creator reads.

**Files:** `lib/db/src/migrations/[next]_conversation_tracking.sql`, `lib/db/src/schema/`
**Effort:** S
**Depends on:** —

---

### [FS-02] Twin chat endpoint propagates `conversation_id`

**Why:** Twin chat route must mint a new `conversation_id` for the first fan message and reuse it for continuations. The id flows into every generation job, every history row, and (downstream) every outbound CTA link.

**Scope:**
- Update `POST /api/twin/chat` (`artifacts/api-server/src/routes/twin.ts`).
- Accept optional `conversation_id` in request; if missing or unknown, mint a new UUID.
- Return `conversation_id` in the response so the surface (web, Telegram bot) can carry it on follow-ups.
- Persist one `conversation_history` row for the fan message + one for the twin response.
- Set the `conversation_id` on the BullMQ generation job payload.

**Acceptance:**
- [ ] First fan message returns a new `conversation_id`; subsequent messages with that id continue the same thread.
- [ ] `conversation_history` rows recorded for both turns.
- [ ] `generation_jobs.conversation_id` populated.

**Files:** `artifacts/api-server/src/routes/twin.ts`, `lib/db/src/schema/`
**Effort:** S
**Depends on:** FS-01, RT-01 (real twin endpoint)

---

## Web funnel — `lala.la/[handle]`

### [FS-03] Replace paywall modal with subscription CTA

**Why:** The fan-page paywall (`artifacts/web/src/pages/fan-page.tsx` lines 389-504) is UI theater (dummy `#subscribe` / `#credits` links). Under Option A it needs to become a clean handoff: "loved chatting with her? subscribe on her [Patreon/Fanvue]."

**Scope:**
- Delete the paywall modal markup (lines 389-504).
- Build a new `<SubscribeCta>` component: creator's avatar, one-line value prop, large "💎 Subscribe on her [platform name]" button.
- Component reads `subscription_url` and `subscription_platform_label` from the creator config (FS-04).
- Triggered by trial counter threshold (e.g. ≥ 3 messages), shown as inline footer card not blocking modal — per "no dark pattern" rule (§2 PRD non-goal kept).
- Outbound link includes UTMs (FS-05).

**Acceptance:**
- [ ] Paywall modal gone.
- [ ] After N free messages, the CTA appears inline below the chat.
- [ ] Click navigates to the configured subscription URL in a new tab.
- [ ] Component renders cleanly in EN, JP, ZH-TW (FS-06).
- [ ] Storybook entry or screenshot in the PR.

**Files:** `artifacts/web/src/pages/fan-page.tsx`, `artifacts/web/src/components/SubscribeCta.tsx` (new)
**Effort:** M
**Depends on:** FS-04, FS-06

---

### [FS-04] Add `subscription_url` + `subscription_platform_label` to creator config

**Why:** Each creator monetizes on a different platform (Patreon / Fanvue / Telegram Stars / her own site). The funnel CTA needs to know where to send fans.

**Scope:**
- Add two fields to the `CreatorConfig` TS type in `artifacts/web/src/lib/creator-fixtures.ts`:
  - `subscription_url: string | null`
  - `subscription_platform_label: string | null` (e.g. "Patreon", "Fanvue", "Buy me a coffee")
- Add the same fields to the server-side `creators.config` JSONB in the DB layer (no migration needed — `config` is JSONB).
- Update the fixture data for `dev-creator` to point to a test URL.

**Acceptance:**
- [ ] TS types reflect new fields.
- [ ] Fixture renders the new fields in FS-03's CTA.

**Files:** `artifacts/web/src/lib/creator-fixtures.ts`
**Effort:** S
**Depends on:** —

---

### [FS-05] Outbound CTA carries `conversation_id` as UTM

**Why:** Attribution depends on the host-platform conversion (Patreon sub, Fanvue PPV) being matchable back to the twin conversation that drove it. UTM tags are the simplest cross-domain handoff.

**Scope:**
- When the user clicks the `<SubscribeCta>` button (FS-03), construct the outbound URL with appended UTMs:
  - `utm_source=lala`
  - `utm_medium=web`
  - `utm_campaign=ai_chat`
  - `utm_content=[creator-handle]`
  - `conversation_id=[id]` (custom param, not part of standard UTM but downstream attribution code expects it)
- Same UTMs used for Telegram inline keyboard CTAs (FS-09).

**Acceptance:**
- [ ] Click on CTA navigates to the URL with all five params populated.
- [ ] If `conversation_id` is missing (no chat yet), still navigate but omit the param.

**Files:** `artifacts/web/src/components/SubscribeCta.tsx`, shared util `artifacts/web/src/lib/attribution-url.ts` (new)
**Effort:** S
**Depends on:** FS-02, FS-03

---

### [FS-06] i18n — CTA strings in EN / JP / ZH-TW

**Why:** Three locales are already supported in `artifacts/web/src/lib/i18n.ts`. New CTA strings need translations to match.

**Scope:**
- Add to the i18n message tree under `fan_page.cta`:
  - `cta_title` — "Loved chatting with her?"
  - `cta_body` — "Keep going on her [{platform}] — exclusive content, voice notes, more 💫"
  - `cta_button` — "💎 Subscribe on her {platform}"
- Localized variants for JP and ZH-TW (cheerleader tone — per north-star Lala's-voice section). Use 啦啦 in ZH-TW where Lala is referenced.

**Acceptance:**
- [ ] All three strings present in all three locales.
- [ ] `{platform}` interpolation works.
- [ ] No untranslated keys (would error per existing i18n type guarantees).

**Files:** `artifacts/web/src/lib/i18n.ts`
**Effort:** S
**Depends on:** —

---

### [FS-07] Trial counter — soft nudge instead of block

**Why:** Existing `trialCount` localStorage logic (`fan-page.tsx`) currently triggers the paywall block. Under Option A it becomes a soft nudge: after N messages the CTA gets more prominent; the chat keeps working.

**Scope:**
- Keep the localStorage counter — useful signal for "engaged fan" cohorts.
- Remove the modal-trigger logic.
- Pass `trialCount` as a prop to `<SubscribeCta>`; component shows a more prominent CTA when count ≥ 5 (e.g. larger button, "you've really hit it off with her — keep going on her [platform]" subtitle).
- Never block messaging — fans can chat indefinitely.

**Acceptance:**
- [ ] No modal ever blocks chat.
- [ ] CTA visibility / prominence scales with trial count.
- [ ] Counter resets when fan returns after a long absence (optional polish — define threshold).

**Files:** `artifacts/web/src/pages/fan-page.tsx`, `artifacts/web/src/components/SubscribeCta.tsx`
**Effort:** S
**Depends on:** FS-03

---

## Telegram fan-twin (Claire — N=1 hardcoded)

### [FS-08] New `artifacts/fan-twin/` artifact — Claire's bot scaffold

**Why:** Claire's bot is per-creator. The fan-twin service must be its own artifact (separate from Lala's `artifacts/hermes/`) so the two run independently on Replit and each has its own bot token.

**Scope:**
- New Replit artifact `artifacts/fan-twin/` with package `@workspace/fan-twin`.
- Mirror the `artifacts/hermes/` structure (Telegraf + Supabase wiring, webhook + polling fallback).
- Read bot token from a Claire-specific env var — **name TBD from user** (ticket blocker; ask user before merge: `CLAIRE_BOT_TOKEN`? `CLAIRE_AI_BOT_TOKEN`?).
- Bot handle (e.g. `@claire_ai_bot`) — also TBD from user.
- Hardcoded creator handle mapping: this bot's messages always belong to Claire's `creator_id`. Store as `CLAIRE_CREATOR_ID` env var or in `creator-fixtures` server-side.
- Add `.replit-artifact/artifact.toml` mirroring Hermes' (port, dev/prod commands).
- Comment in code: `// At N=1 (Claire) this is hardcoded. At N=2 we add a creator_bots table and read from DB. See plan doc.`

**Acceptance:**
- [ ] Sending a message to Claire's bot triggers a stub reply.
- [ ] Bot launches in both webhook and polling mode.
- [ ] Replit artifact-tooling recognizes it (`pnpm --filter @workspace/fan-twin run dev` runs it).
- [ ] Token + creator-handle pulled from env vars; no secrets in code.

**Files:** `artifacts/fan-twin/` (new artifact: `package.json`, `tsconfig.json`, `src/index.ts`, `src/db.ts`, `.replit-artifact/artifact.toml`), `pnpm-workspace.yaml`
**Effort:** M
**Depends on:** *(user-supplied)* Claire's env var name + bot handle

---

### [FS-09] Fan-twin routes messages to `/api/twin/chat` with inline CTA

**Why:** The fan-twin bot's job is thin: forward fan messages to the existing twin runtime (Track A from Real Twin), display the response, and surface the subscription CTA as an inline keyboard button on every twin reply.

**Scope:**
- On fan message: call `POST /api/twin/chat` with `creatorId=Claire's id, message=fan text, conversation_id=` (stored per-fan in Redis, key `fan-twin:conv:{telegramUserId}:{creatorId}`).
- Render twin response as a Telegram message reply.
- Each twin reply has an inline keyboard with a single button: `💎 More from [Claire's name] →` linking to her `subscription_url` with the same UTM params as web (FS-05), including `conversation_id`.
- If twin endpoint returns an error, friendly fallback reply (similar tone to RT-01's "twin is resting").
- Fan name masking on inbound (RT-08 patterns can be reused — though inbound text doesn't need image masking).

**Acceptance:**
- [ ] Fan messages Claire's bot → bot replies with persona-grounded twin response.
- [ ] Inline button on every reply links to Claire's `subscription_url` with all UTMs + `conversation_id`.
- [ ] Same `conversation_id` reused across the fan's session.
- [ ] Logged in `conversation_history` with `surface='telegram'`.

**Files:** `artifacts/fan-twin/src/index.ts`, `artifacts/fan-twin/src/handlers.ts` (new), shared `lib/attribution-url.ts` (FS-05)
**Effort:** M
**Depends on:** FS-02, FS-05, FS-08

---

## Summary

| Ticket | Group | Effort | Depends on |
|---|---|---|---|
| FS-01 conversation_id + conversation_history migration | Tracking | S | — |
| FS-02 Twin chat endpoint propagates conversation_id | Tracking | S | FS-01, RT-01 |
| FS-03 Replace paywall modal with subscription CTA | Web funnel | M | FS-04, FS-06 |
| FS-04 Add subscription_url to CreatorConfig | Web funnel | S | — |
| FS-05 Outbound CTA carries conversation_id UTM | Web funnel | S | FS-02, FS-03 |
| FS-06 i18n CTA strings EN/JP/ZH-TW | Web funnel | S | — |
| FS-07 Trial counter → soft nudge | Web funnel | S | FS-03 |
| FS-08 New artifacts/fan-twin/ scaffold | Telegram | M | user-supplied env vars |
| FS-09 Fan-twin routes to twin/chat + inline CTA | Telegram | M | FS-02, FS-05, FS-08 |

**Total:** 9 tickets. Critical-path sequencing: **FS-01 → FS-02** (everything attribution-related depends on these). **FS-04 + FS-06** can land first as zero-dep cleanup. The Telegram side (FS-08, FS-09) is blocked by user-supplied env-var name + Claire's bot handle.

**Open question to user before merging FS-08:**
- Env var name for Claire's bot token?
- Claire's Telegram bot handle?
- Claire's stored `creator_id` in the DB?
