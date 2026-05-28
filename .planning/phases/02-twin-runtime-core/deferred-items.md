# Deferred items — Phase 02 twin-runtime-core

Issues discovered during plan execution that are OUT OF SCOPE for the
current plan. Tracked for future cleanup, not fixed inline.

## From 02-04 (web fan-page refactor)

Pre-existing TypeScript errors in `artifacts/web` (discovered while running
`pnpm --filter @workspace/web run typecheck`):

- `src/lib/cookie-consent.ts:154` — Cannot find module `posthog-js` (missing
  optional analytics dependency).
- `src/pages/dashboard-security.tsx:220` — Reference to undefined
  `setQrDataUrl` symbol.
- `src/pages/fan-dsar.tsx` — ~30 references to `Messages.dsar` keys that
  the type does not declare (`fan_tab`, `creator_tab`, `fan_title`,
  `creator_title`, `fan_notice`, `creator_notice`, `email_label`,
  `email_placeholder`, `email_invalid`, `request_type_*`, `done_*`,
  `submitting`, `powered_by`, etc.). The `dsar` namespace in `lib/i18n.ts`
  needs a structural overhaul to match what `fan-dsar.tsx` consumes.

All errors pre-date this plan. None of the files touched by 02-04
(`components/fan/*`, `lib/i18n.ts fan namespace`, `lib/api.ts`,
`pages/fan-page.tsx`, `index.css .dark block`) introduce new diagnostics.

**Vite build break (pre-existing):**
`pnpm --filter @workspace/web run build` fails with
`[vite]: Rollup failed to resolve import "posthog-js" from src/lib/cookie-consent.ts`.
Same root cause as the `posthog-js` typecheck error above — the package is
not listed in `artifacts/web/package.json` deps. Either install `posthog-js`
or stub it out in `cookie-consent.ts`. Out of scope for 02-04 (the fan-page
refactor); flag for a near-term hygiene plan.
