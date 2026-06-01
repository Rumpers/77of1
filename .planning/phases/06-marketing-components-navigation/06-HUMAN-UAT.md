---
status: partial
phase: 06-marketing-components-navigation
source: [06-VERIFICATION.md]
started: 2026-06-01T08:00:00Z
updated: 2026-06-01T08:00:00Z
---

## Current Test

[awaiting human/browser testing]

## Tests

### 1. 375px responsive overflow (SC-5 / MKT-11)
expected: At 375px viewport width, `document.documentElement.scrollWidth === 375` (no horizontal overflow) on the assembled marketing page at `/en`.
result: [pending]

### 2. Visual marketing page render
expected: `/en` renders the dark violet "Luminous Infrastructure" marketing page (hero orb, nav, all sections, footer) — NOT the old throwaway prototype with variant directions.
result: [pending]

### 3. CTA click behavior (MKT-08/MKT-09)
expected: Primary CTA at hero, mid-page, and footer all route to the same `https://t.me/<bot>?start=<payload>` deep-link; mailto fallback visible. Assess CR-01 (href-less anchor when VITE_HERMES_BOT_URL unset) in practice.
result: [pending]

### 4. Locale switcher routing (MKT-14)
expected: Marketing nav locale switcher changes URL to `/ja`, `/zh-TW`, `/en` (no handle segment) and re-renders localized copy.
result: [pending]

### 5. Fan route isolation
expected: `/en/<somehandle>` still loads the fan chat page unchanged — marketing nav does not interfere with the fan-page locale switcher.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
