---
phase: 03-voice-hardening
plan: 05
type: summary
status: complete
requirements: [ONBOARD-04, I18N-01]
---

# 03-05 SUMMARY — /review_masks founder review queue (ONBOARD-04)

ONBOARD-04 vertical slice: founder runs `/review_masks` in Hermes → reviews
`fan_name_masks` rows one at a time → approves/rejects via inline Telegram
buttons. OCR ingestion itself is deferred to creator #3+; this ships only the
review-queue scaffold + table + UI.

## What shipped

| Component | File | Detail |
|---|---|---|
| DB helpers | `artifacts/hermes/src/db.ts` | `getNextPendingMask()` — SELECT next `reviewed=false` row JOINed to `creators.handle` for scoping (W6), ordered by `created_at ASC LIMIT 1`. `setMaskReviewed(id, approved)` — sets `reviewed=true, approved, reviewed_at=NOW()`; throws on non-UUID id (defense-in-depth). Uses Drizzle via `@workspace/db`. |
| Scene | `artifacts/hermes/src/scenes/review-masks.scene.ts` | `reviewMasksWizard` — 1-step `WizardScene` id `"review-masks-wizard"`. Fetches next pending mask; empty → `reviewMasksEmpty` + `scene.leave()`. Renders row template with two `Markup.button.callback` inline buttons (`mask:approve:{uuid}`, `mask:reject:{uuid}`). |
| Command | `artifacts/hermes/src/index.ts` | `bot.command("review_masks")` — founder-gated; resolves locale from `creator_config.hermes_language`; non-founder gets `reviewMasksUnauthorized`. |
| Callback handler | `artifacts/hermes/src/index.ts` | `bot.action(/^mask:(approve|reject):(.+)$/)` registered at bot scope **after** `bot.use(stage.middleware())`. Re-checks `isFounder`; UUID-regex-validates id before any DB call; `setMaskReviewed`; `answerCbQuery` ack; strips inline keyboard; re-enters scene to show next row. |
| Founder gate | `artifacts/hermes/src/index.ts` | `FOUNDER_TELEGRAM_USER_ID` (comma-separated user_ids) parsed at boot; `isFounder(tgUserId)` helper; boot warn if unset. Gate enforced on BOTH command entry and callback handler. |
| Env contract | `.env.example` | Added `FOUNDER_TELEGRAM_USER_ID` (distinct from existing `FOUNDER_TELEGRAM_CHAT_ID`). |
| i18n | `artifacts/hermes/src/i18n.ts` | 7 new keys × 3 locales (EN/JA/ZH-TW) = **21 entries**: `reviewMasksEmpty`, `reviewMasksRowTemplate` (incl. `{creatorHandle}` scoping in all locales), `reviewMasksApproveButton`, `reviewMasksRejectButton`, `reviewMasksApprovedAck`, `reviewMasksRejectedAck`, `reviewMasksUnauthorized`. |

## Threat mitigations

- **T-03-05-01 (privilege escalation):** `isFounder()` gate on command + callback.
- **T-03-05-02 (callback tampering):** UUID regex in both `index.ts` and `db.ts`; parameterized Drizzle SQL.
- **T-03-05-03 (PII disclosure):** founder-gate blocks fetch before any reply.
- **T-03-05-06 (log leakage):** handler logs decision + id only, never candidate text.

## Verification

- `pnpm --filter @workspace/hermes run typecheck` → exit 0.
- All Task 1 + Task 2 acceptance-criteria greps pass (export counts, 21 i18n keys, scene id, 2 inline buttons, command + action registration, founder/UUID refs).
- `bot.action` registered after `stage.middleware()` (line 282 vs 62) so `ctx.scene` is available.

## Deferred

- Integration test (seed 2 rows → approve → assert next → reject → assert empty) deferred to 03-08 per plan `<verification>`.
- OCR ingestion path (the producer of `fan_name_masks` rows) deferred to creator #3+ per `03-CONTEXT.md`.
