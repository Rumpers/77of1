---
phase: 06
slug: marketing-components-navigation
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-01
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Surface: static, client-rendered marketing site (`artifacts/web`). No auth, no DB writes, no user-input fields, no backend changes, no `dangerouslySetInnerHTML`. No HIGH threats.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| build-time env → client bundle | `VITE_HERMES_BOT_URL` / `VITE_CONTACT_EMAIL` inlined by Vite at build | Non-secret config (public bot URL, public email) |
| i18n namespace → DOM | Localized copy rendered as auto-escaped React text children | Static UI strings (no PII) |
| client → external (t.me / mailto) | Outbound navigation to Telegram + public contact email | Public destinations only |
| client router → route resolution | `/:locale` must not leak into `/:locale/:handle` (fan route) | Route segments |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-06-01 | Tampering (tab-napping) | External CTA links (CtaButton + nav/footer/CtaSection reuse) | mitigate | `target="_blank"` + `rel="noopener noreferrer"` on the sole external anchor primitive (`CtaButton.tsx:37-38`); all surfaces delegate to it. Verified: no other external anchor exists. | closed |
| T-06-02 | Information Disclosure | mailto fallback | accept | Exposes only public `contact@lala.la`; no PII. | closed |
| T-06-03 | Tampering | Telegram deep-link build | accept | `HERMES_BOT_URL = import.meta.env.VITE_HERMES_BOT_URL` (build-time); no runtime interpolation of user data into the `t.me` URL. | closed |
| T-06-04 | Tampering (XSS) | All marketing/home copy rendering | mitigate | Zero `dangerouslySetInnerHTML` in the marketing tree (grep-verified); all copy is auto-escaped React text from the typed i18n namespace + static consts. | closed |
| T-06-05 | Repudiation / Compliance (SB-243) | Hero disclosure pill + demo transcript | mitigate | AI disclosure rendered (`HeroSection.tsx:92` "AI twin · not a real person"; `DemoTranscriptSection.tsx:82` attribution). MKT-19 prohibited overclaiming phrases absent (grep-verified). Disclosure visible on every page. | closed¹ |
| T-06-06 | Spoofing / Elevation | Footer privacy link + locale switcher + route order | mitigate | Outbound paths use allow-listed `LOCALES` (`["en","ja","zh-TW"]`) or validated `Locale` prop — never free-text. `App.tsx:46` `/:locale` ordered above `/:locale/:handle` (`:73`). | closed² |
| T-06-SC | Tampering (supply chain) | npm/pnpm installs | accept | No `package.json`/lockfile changes in any Phase-06 commit (git-verified); existing deps only. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

¹ **Phase-7 carry-forward:** hero/demo disclosure copy is hardcoded English and does not localize to JA/TW (REVIEW.md WR-04). For Phase 6 the disclosure is present on every page (all locales fall back to EN marketing copy per the documented design decision). SB-243 obligation is satisfied for the EN launch surface; **localize `t.hero.disclosure` + demo attribution before any JA/TW go-live.**

² **Qualification (URF-01, below):** outbound link construction is correctly allow-listed; the related inbound route-permissiveness defect is logged as an unregistered LOW-severity flag, not a T-06-06 gap.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-02 | mailto fallback exposes only the already-public `contact@lala.la`; no PII or credentials. | Phase plan (06-01) | 2026-06-01 |
| AR-06-02 | T-06-03 | Telegram deep-link is built from build-time env, not user input; no untrusted runtime interpolation. | Phase plan (06-01) | 2026-06-01 |
| AR-06-03 | T-06-SC | No new dependencies installed during Phase 6; build uses pre-existing deps verified in RESEARCH.md. | Phase plan (all) | 2026-06-01 |

---

## Unregistered Flags

| Flag | Source | Description | Severity | Disposition |
|------|--------|-------------|----------|-------------|
| URF-01 | REVIEW.md WR-02 | `/:locale` matches any single segment inbound — `/foobar` serves the EN marketing page at HTTP 200 instead of 404. NOT a T-06-06 gap (fan route needs two segments; outbound construction is allow-listed). Static surface, no PII, no auth bypass — SEO/correctness defect. | LOW | Defer to Phase 7 (add locale allow-list / 404). Non-blocking. |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-01 | 7 | 7 | 0 | gsd-security-auditor (sonnet) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-01
