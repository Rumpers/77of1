---
phase: 05-foundation-isolation
plan: 02
subsystem: web-public-assets
tags: [seo, sitemap, robots, og-image, static-assets, mkt-16, mkt-17]
dependency_graph:
  requires: []
  provides:
    - artifacts/web/public/sitemap.xml
    - artifacts/web/public/robots.txt
    - artifacts/web/public/og-marketing.png
  affects:
    - Plan 03 (index.html hreflang + og:image meta tags reference these files)
tech_stack:
  added: []
  patterns:
    - Static public/ asset delivery (Vite copies public/ verbatim into dist/public/)
    - ImageMagick for placeholder brand PNG generation
key_files:
  created:
    - artifacts/web/public/sitemap.xml
    - artifacts/web/public/og-marketing.png
  modified:
    - artifacts/web/public/robots.txt
decisions:
  - "og-marketing.png generated via ImageMagick (convert) — solid #7c3aed background, wordmark + tagline, no creator likeness (D-05-04)"
  - "sitemap.xml lists exactly /en, /ja, /zh-TW — no fan handles, no internal routes (T-05-04 threat mitigated)"
  - "robots.txt trailing-slash rule: Allow: /en + Disallow: /en/ keeps marketing root crawlable while blocking fan pages"
metrics:
  duration: 109s
  completed: "2026-05-31"
  tasks_completed: 3
  files_changed: 3
requirements_satisfied: [MKT-16, MKT-17]
---

# Phase 05 Plan 02: Static SEO Assets Summary

## One-liner

Locale sitemap (3 URLs + hreflang), robots directives (marketing allow / fan-page disallow), and 1200x630 brand OG card via ImageMagick committed to artifacts/web/public/.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | sitemap.xml — 3 locale URLs + hreflang alternates | 163ecba | artifacts/web/public/sitemap.xml |
| 2 | robots.txt — marketing allow / fan-page disallow | dc9a3ef | artifacts/web/public/robots.txt |
| 3 | og-marketing.png — 1200x630 brand card | e457bb7 | artifacts/web/public/og-marketing.png |

## Verification Results

All acceptance criteria passed:

**sitemap.xml:**
- Exactly 3 `<loc>` entries: `https://lala.la/en`, `https://lala.la/ja`, `https://lala.la/zh-TW`
- 3 hreflang x-default entries, each pointing to `https://lala.la/en`
- No internal/fan routes (grep for onboard/dashboard/account/payment returned nothing)
- Valid XML (python3 xml.dom.minidom.parse passed)

**robots.txt:**
- 3 Allow lines: /en, /ja, /zh-TW
- 3 Disallow lines with trailing slash: /en/, /ja/, /zh-TW/
- Disallow: /payment/
- Sitemap: https://lala.la/sitemap.xml
- No creator handle or internal route

**og-marketing.png:**
- `file` reports: PNG image data, 1200 x 630, 16-bit/color RGB, non-interlaced
- Size: 25,747 bytes (well under 300KB limit)
- Tool: ImageMagick `convert` — solid #7c3aed background, white text, "lala.la" + "Your AI twin, fully managed"
- No creator likeness — generated entirely from brand text/color

## Deviations from Plan

None — plan executed exactly as written. ImageMagick was confirmed available (`/usr/bin/convert`) and used as the primary generation method specified in the plan.

## Known Stubs

None. All three files are fully functional static assets. og-marketing.png is an intentional Phase 5 placeholder (plan explicitly states final artwork is Phase 7).

## Threat Flags

No new security surface introduced. All three files are static public assets with no user input, no auth surface, no new endpoints. T-05-04 and T-05-05 mitigations are fully implemented and verified by acceptance-criteria grep assertions.

## Self-Check: PASSED

- [x] artifacts/web/public/sitemap.xml — exists, 3 locs, valid XML
- [x] artifacts/web/public/robots.txt — exists, correct directives
- [x] artifacts/web/public/og-marketing.png — exists, 1200x630 PNG, 25KB
- [x] 163ecba — feat(05-02): add sitemap.xml with 3 locale URLs + hreflang alternates
- [x] dc9a3ef — feat(05-02): replace robots.txt — allow marketing roots, disallow fan paths
- [x] e457bb7 — feat(05-02): add og-marketing.png — 1200x630 brand card (MKT-16)
