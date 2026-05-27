# 7of1 — Hidden Requirements: Ticket Drafts

Derived from a gap-audit of `PRD.md` (Draft v8, 2026-05-24). These are features, flows, and infrastructure the PRD **implies** but does not explicitly define. Each is drafted as a paste-ready ticket for the team tracker.

- **HID-XXX** prefix avoids collision with existing **OF-XXX** numbering. Re-number on intake.
- **Priority:** P0 = launch-blocker (Slices 1–3) · P1 = scale/quality · P2 = later.
- **Effort:** S ≤ 2d · M ≤ 1wk · L ≤ 2wk · XL > 2wk.
- All references are to sections of `.migration-backup/docs/PRD.md`.

---

## ⚠ Status update (2026-05-27): Deferred under Option A

The product has pivoted to an **AI agency layer that operates on top of existing fan-monetization platforms** (Fanvue / Patreon / Telegram paid channels / Discord paid roles / creator's own site). See `docs/north-star.md`.

We **never run the fan-payment loop**. Host platforms own fan auth, payments, age-gating, refunds, chargebacks, fan-side DSAR, fan-side crisis intervention, fan-side T&S. The following tickets are therefore **deferred — out of scope** unless we ever revisit the platform-play (Option B):

| Ticket | Why deferred |
|---|---|
| HID-004 Fan account recovery | Host platform owns fan accounts |
| HID-006 Account deletion UX (fan side) | Host platform owns fan accounts; creator-side deletion still applies |
| HID-008 18+ age verification (fan side) | Host platform enforces; we still gate our own creator-side training on 18+ |
| HID-011 Manual refund review queue | Fans don't pay us |
| HID-017 DSAR intake & fulfillment (fan side) | Host platform owns fan PII; creator-side DSAR remains |
| HID-020 Refund processing engine | Fans don't pay us |
| HID-021 Convenience-store pending UX | Fans don't pay us |
| HID-022 Tax collection (fan transactions) | Host platform collects; our own creator-side tax obligations remain |
| HID-023 Invoice / receipt generation (fan side) | Host platform issues; creator-side invoices remain (Phase 4) |
| HID-024 Credit expiration policy | No credits |
| HID-025 Subscription dunning (fan side) | Host platform handles |
| HID-026 Chargeback handling (fan side) | Host platform handles |
| HID-027 Multi-currency wallet | No wallet |
| HID-028 Fan reporting mechanism | Host platform owns |
| HID-029 Creator-side fan blocking | Host platform owns |
| HID-030 Crisis intervention (fan side) | Host platform's responsibility — we still need internal escalation if signals reach us via Lala |
| HID-031 Platform-wide ban list | Host platforms maintain |
| HID-035 DSAR self-service portal (fan side) | Host platform owns |

That's **18 tickets** dissolved. Remaining tickets still apply (creator-side identity / auth, admin/ops tooling, compliance scaffolding for creators, twin engine, content engine, Hermes/Lala ops, onboarding, operational SLOs).

> **Naming note:** these tickets were drafted before the **Hermes → Lala** rename (Phase 0, 2026-05-27). Wherever the body of a ticket below says "Hermes," read as "Lala" — same agent, new creator-visible name. Internal codename remains Hermes in code/packages.

**Two new tickets** the agency model implies which weren't in the original audit:

- **HID-074 Conversation-credit attribution layer.** `conversation_id` on every twin response; UTM propagation through outbound CTAs; host-platform conversion webhook ingestion; 7-30d attribution window matching. Foundational for rev-share billing. **Priority:** P0 (Phase 2).
- **HID-075 Host-platform connector layer.** Per-platform adapters (Patreon API first, Telegram Stars, Discord, IG via creator OAuth). Each adapter is one creator-monetization venue unlocked. **Priority:** P0 ongoing; first adapter in Phase 6.

---

## A. Identity, Auth & Account Management

### HID-001: Transactional email infrastructure
**Why:** Magic-link auth (§22.4), payment receipts, refund confirmations, DSAR-ready notices, dunning, and consent receipts all require a transactional email pipeline. None named in PRD.
**Scope:**
- Choose provider (Postmark / SendGrid / Resend / SES). Deliverability in JP/TW/HK is the selection criterion.
- Templated, locale-aware emails (EN / JP / ZH-TW).
- Bounce/complaint handling + suppression list.
- Per-template open/click metrics into PostHog.
- DKIM/SPF/DMARC for `7of1.[tld]`.
**Acceptance:**
- [ ] Send magic-link email in <5s p95.
- [ ] Bounces auto-suppress.
- [ ] Locale chosen from user pref, then browser, then default EN.
- [ ] Templates in version control, previewable in dev.
**Priority:** P0 · **Effort:** M · **PRD ref:** §22.4

### HID-002: SMS / phone-OTP provider integration
**Why:** §22.4 lists "phone OTP" as auth path. Provider not chosen; JP/TW deliverability is a known minefield.
**Scope:**
- Twilio / MessageBird / local JP carrier aggregator evaluation.
- Per-region routing (JP carriers reject some international long codes).
- Rate-limit + fraud protection (SIM swap / OTP harvesting).
- Fallback to email magic link if SMS fails.
**Acceptance:**
- [ ] OTP delivered <30s p95 in JP/TW/SG.
- [ ] Brute-force attempts throttled per phone + per IP.
- [ ] Cost ceiling alert when monthly spend > $X.
**Priority:** P0 · **Effort:** M · **PRD ref:** §22.4

### HID-003: Creator account recovery without Telegram
**Why:** Hermes is "the creator's interface" (§5.5). If she loses her Telegram account, there is no defined recovery path.
**Scope:**
- Recovery email + phone on file at onboarding.
- Identity re-verification flow (matches §8.6 personality-rights signature on file).
- Manual review queue for ambiguous cases.
- Re-link new Telegram (or LINE/WhatsApp) account after verification.
**Acceptance:**
- [ ] Creator can initiate recovery from web fan page footer + 7of1.com.
- [ ] Recovery completes in <24h for verified identities.
- [ ] Lockout audit log entry for every recovery event.
**Priority:** P0 · **Effort:** M · **PRD ref:** §5.5

### HID-004: Fan account recovery
**Why:** Magic-link auth (§22.4) breaks if fan loses email access. Credit balance is at stake.
**Scope:** Backup email or phone, ID-attested recovery for balances > $X, support escalation path.
**Acceptance:**
- [ ] Fans with credits can recover via identity attestation.
- [ ] Fraud-flag patterns (rapid recovery + immediate liquidation) raise review.
**Priority:** P0 · **Effort:** S · **PRD ref:** §22.4

### HID-005: Session management
**Why:** Multi-device fan use (mobile + desktop) and creator Hermes-plus-web logins need explicit session lifecycle. Not in PRD.
**Scope:**
- Session table with `device`, `last_active`, `ip`, `user_agent`.
- "Log out everywhere" control on creator and fan account pages.
- Auto-expiry on credential change (password reset / magic-link rotation).
- Audit log entry on every session creation.
**Acceptance:**
- [ ] Active sessions visible to user.
- [ ] Revocation propagates <60s.
**Priority:** P0 · **Effort:** S · **PRD ref:** —

### HID-006: Account deletion UX (fan + creator)
**Why:** §8.4 mandates one-click data deletion; §16 requires complete deletion in 72h. UI flow undefined for fans; creator path is implied via Hermes only.
**Scope:**
- Fan: deletion request from account settings + email confirmation + 7-day grace window.
- Creator: deletion request via Hermes *and* web dashboard, with re-authentication.
- Cascade: persona, RAG, LoRA, voice clone, conversation history, derived assets.
- Consent records retained per §8.3 audit requirements, marked deleted.
**Acceptance:**
- [ ] Deletion completes within 72h; verifiable via internal tooling (see HID-013).
- [ ] User receives written confirmation when complete.
- [ ] Consent record retains revocation timestamp + auditable proof of asset purge.
**Priority:** P0 · **Effort:** L · **PRD ref:** §8.4, §16, §23.5

### HID-007: 2FA for creator accounts
**Why:** Creators control payouts, persona, kill switch. No 2FA in PRD.
**Scope:** TOTP (Authy/Google Authenticator) + recovery codes. Optional at first, mandatory before payout enable.
**Acceptance:**
- [ ] Creator can enable TOTP from Hermes or dashboard.
- [ ] Payout enable forces 2FA setup.
**Priority:** P1 · **Effort:** S · **PRD ref:** §8

### HID-008: 18+ age verification at registration + payment
**Why:** §8.12 mandates "Age gate enforced at fan account registration" and "re-verification at payment initiation." Self-declared checkbox is insufficient for JP/TW.
**Scope:**
- Evaluate Persona / Onfido / local JP equivalent (e-KYC: ekyc.jp).
- Checkbox at signup; document/face verification at payment when local law requires.
- Edge cases: under-16 attempts → block + delete session-only data per §8.12.
**Acceptance:**
- [ ] Age verification fails closed (no chat past free trial without 18+).
- [ ] Cost per verification tracked; aim < $1 per fan.
- [ ] Audit trail per verification.
**Priority:** P0 · **Effort:** L · **PRD ref:** §8.12

### HID-009: "Open in browser" escape from IG/TikTok webview
**Why:** §5.1 *requires* "clean open-in-browser escape for payment" but no design.
**Scope:**
- Webview detection (UA sniff + heuristics).
- Deep-link intent on Android, Universal Link on iOS, copy-URL fallback.
- Continuity: session token survives the jump.
- Tested on real devices, not just emulators.
**Acceptance:**
- [ ] In IG, TikTok, X, Facebook in-app webviews: tapping "Pay" lands the user in Safari/Chrome with logged-in state.
- [ ] Loss rate from chat → checkout < 10% (PostHog funnel).
**Priority:** P0 · **Effort:** M · **PRD ref:** §5.1, §22.5

---

## B. Admin / Internal Tooling

### HID-010: Internal admin console (scaffold)
**Why:** PRD describes creator + fan surfaces. Nothing for 7of1 staff. Required from day 1 for support, refunds, ops.
**Scope:**
- SSO (Google Workspace).
- Role-based access (support / ops / engineering / finance).
- Everything below (HID-011..019) plugs in here.
- Per-action audit log: who did what, when, why.
**Acceptance:**
- [ ] Staff cannot read fan PII without justification recorded.
- [ ] Every mutating action is signed + logged for 12 months (§8.3).
**Priority:** P0 · **Effort:** L · **PRD ref:** —

### HID-011: Manual refund review queue
**Why:** §10.9 promises "7-day goodwill refund on unused credits, review on others." No queue defined.
**Scope:**
- Inbound channel: fan refund-request form + email.
- Worklist view: amount, fan history, creator, reason, evidence (transcript excerpt).
- One-click approve / deny / partial; reason codes; Stripe refund call.
- SLA: respond <72h.
**Acceptance:**
- [ ] Refund processed end-to-end from queue.
- [ ] Fan notified by email (HID-001) of outcome.
- [ ] Decisions logged + analyzable for policy tuning.
**Priority:** P0 · **Effort:** M · **PRD ref:** §10.9, §6

### HID-012: Concierge-tier ops console
**Why:** §12 names a "Concierge" tier with "dedicated manager." No CRM/console defined.
**Scope:**
- Per-creator notes, campaign briefs, content briefs, escalations.
- Inbound from creator → human queue routing.
- Activity log of every action taken on creator's behalf.
**Acceptance:**
- [ ] Account manager can run a creator's calendar from one screen.
- [ ] All actions attribute to a human, not "the system."
**Priority:** P2 · **Effort:** L · **PRD ref:** §12

### HID-013: Data-deletion verification tooling
**Why:** §16 requires "complete and verifiable" deletion in 72h. Verification unspecified.
**Scope:**
- Per-creator/per-fan deletion checklist with cross-system enumeration (DB rows, vector index entries, S3/GCS blobs, voice clones at provider, LoRA artifacts).
- Attestation report stored with consent record.
- Re-check scheduled at 24h + 7d post-deletion.
**Acceptance:**
- [ ] Internal user can run a check and produce a signed report.
- [ ] Provider-side deletion calls (HeyGen, ElevenLabs, etc.) are part of the workflow and confirmed.
**Priority:** P0 · **Effort:** M · **PRD ref:** §16, §23.5

### HID-014: Creator KYC / onboarding gate
**Why:** §8.6 requires "personality rights agreements per creator … before onboarding creator #1." No system specified.
**Scope:**
- Identity document collection (region-appropriate).
- Personality-rights e-signature (DocuSign / SignWell / native).
- Tax form intake (HID-040).
- Onboarding queue with ops sign-off gate.
**Acceptance:**
- [ ] Twin production (Step 3, §14) cannot trigger without signed KYC + personality-rights.
- [ ] Audit pack downloadable for legal.
**Priority:** P0 · **Effort:** L · **PRD ref:** §8.6, §14

### HID-015: Fraud investigation console
**Why:** §8.7 mentions "fraud limits" but no tooling. Credit packs are a money-laundering vector.
**Scope:**
- Velocity / pattern dashboards (rapid signup → large pack → minimal chat → refund).
- Stripe Radar integration; per-fan risk score; ban tooling.
- Chargeback workflow (HID-031).
**Acceptance:**
- [ ] Risk score visible to support.
- [ ] Manual ban + auto-ban thresholds configurable.
**Priority:** P1 · **Effort:** M · **PRD ref:** §8.7

### HID-016: Content-moderation appeal queue
**Why:** Outbound moderation (§5.2) will block creator content. No appeal flow.
**Scope:**
- Per-blocked-asset record with reason + model output.
- Creator can request human review from Hermes.
- Reviewer can override + retrain moderation classifier with labelled examples.
**Acceptance:**
- [ ] Override is logged.
- [ ] Creator notified within 24h of decision.
**Priority:** P1 · **Effort:** M · **PRD ref:** §5.2, §8.3

### HID-017: DSAR intake & fulfillment workflow
**Why:** §16 mandates "Fan DSAR within 30 days." No intake channel exists.
**Scope:**
- Public DSAR request form on `7of1.[tld]/privacy`.
- Ticketing pipeline → identity verification → data assembly → encrypted delivery.
- SLA tracker; statutory clocks per jurisdiction (APPI / PDPA / GDPR-residual).
**Acceptance:**
- [ ] DSAR can be fulfilled end-to-end within 30 days.
- [ ] Statutory reporting available for audits.
**Priority:** P0 · **Effort:** M · **PRD ref:** §16, §8.5

### HID-018: 17 Live payout reconciliation
**Why:** §9 lists 17 Live payout as a launch dependency; §15 lists "17 Live payout integration" as something we build. No spec exists.
**Scope:**
- Daily revenue → per-creator share calculation.
- Hand-off file/API to 17 Live in their required format.
- Two-way reconciliation; dispute workflow.
- Creator-visible "next payout" + history in Hermes/dashboard.
**Acceptance:**
- [ ] Payout file accepted by 17 Live in test env.
- [ ] Discrepancies flagged before transmission.
**Priority:** P0 · **Effort:** L · **PRD ref:** §9, §15

### HID-019: Provider unit-economics dashboard
**Why:** §15 names Helicone for LLM cost; voice/video/image costs not aggregated. Per-creator margin unknown.
**Scope:**
- Per-creator-per-day cost across LLM, voice, video, image, moderation.
- Alert when a creator's cost > revenue.
- Pricing-tier suggestion engine.
**Acceptance:**
- [ ] Cost-per-creator visible per day.
- [ ] Slack alert on loss-making creators >7 days.
**Priority:** P1 · **Effort:** M · **PRD ref:** §15

---

## C. Payments

### HID-020: Refund processing engine
**Why:** §10.9 refund-friendly billing is a stated competitive moat. No backend defined.
**Scope:**
- Refund policy as code: unused credits within 7d → auto; otherwise → HID-011 queue.
- Stripe + LINE Pay + JCB refund APIs unified.
- Partial refunds (credits half-used).
- Refund webhooks → ledger entry → creator-share clawback.
**Acceptance:**
- [ ] Auto-refunds settle within 1h.
- [ ] Creator ledger debited correctly on refund.
**Priority:** P0 · **Effort:** L · **PRD ref:** §10.9, §6

### HID-021: Convenience-store payment pending-state UX
**Why:** §17 specifies it (JP row): "settlement confirmed within 3 business days; UI must handle pending state." No design.
**Scope:**
- Pending state on fan account; credits NOT issued until settlement webhook.
- Email reminders at +24h, +48h, +72h with payment instructions.
- Expiry + cleanup; resume from saved cart.
- Subscription start deferred until settlement.
**Acceptance:**
- [ ] Stripe JP / Komoju webhook integrated; tested end-to-end.
- [ ] Fan can see pending payment in account; cannot double-pay.
**Priority:** P0 · **Effort:** M · **PRD ref:** §17

### HID-022: Tax collection (JCT / TW VAT / SG GST / etc.)
**Why:** Not mentioned in PRD. Mandatory for B2C digital services in JP from JPY 1.
**Scope:**
- Stripe Tax or Avalara (or custom).
- Tax-inclusive vs tax-exclusive pricing per region.
- Per-jurisdiction registration tracking + filing reminders.
- Invoice line items showing tax.
**Acceptance:**
- [ ] Correct tax line on every transaction.
- [ ] Monthly tax report exportable.
- [ ] JCT registered before first JPY collected from JP fan.
**Priority:** P0 · **Effort:** L · **PRD ref:** §6, §17

### HID-023: Invoice / receipt generation
**Why:** Legally required in JP (qualified invoice system / インボイス制度). Not mentioned.
**Scope:**
- PDF receipt per transaction, JP-compliant fields.
- Email delivery (HID-001).
- Per-creator monthly statement for payout reconciliation.
**Acceptance:**
- [ ] Every JP transaction produces a compliant receipt.
- [ ] Receipts retrievable from fan account for 5 years (APPI financial-records retention, §8.3).
**Priority:** P0 · **Effort:** M · **PRD ref:** §8.3, §17

### HID-024: Credit expiration policy
**Why:** Credits-only and hybrid models (§6) have no expiry rule. Legal + accounting implications.
**Scope:**
- Choose policy (e.g., 12 months from purchase or last use).
- Fan UI surfaces expiry; reminder emails (HID-001) at -30d, -7d.
- Forfeited credits → revenue recognition rule.
**Acceptance:**
- [ ] Policy in ToS + checkout.
- [ ] Reminders fire.
- [ ] Forfeit ledger entry generated correctly.
**Priority:** P0 · **Effort:** S · **PRD ref:** §6

### HID-025: Subscription dunning
**Why:** Subscription model (§6) needs failed-renewal handling. Not addressed.
**Scope:**
- Retry ladder (3d, 5d, 7d); pause access on day 3; cancel on day 10.
- Fan-facing email + in-app banner; pay-now button.
- Anti-dark-pattern compliance (§2 non-goals: no auto-convert traps).
**Acceptance:**
- [ ] Cancellations honoured immediately.
- [ ] Recovery rate trackable.
**Priority:** P1 · **Effort:** S · **PRD ref:** §6

### HID-026: Chargeback handling
**Why:** Inevitable with credit-pack purchases. Not in PRD.
**Scope:**
- Stripe / LINE Pay dispute webhooks → internal ticket.
- Evidence assembly (chat transcripts, consent records, anti-fraud signals).
- Ledger reversal + creator-share clawback.
- Repeat-chargeback fan auto-ban list.
**Acceptance:**
- [ ] Dispute responded to <72h.
- [ ] Loss-rate dashboard.
**Priority:** P0 · **Effort:** M · **PRD ref:** §8.7

### HID-027: Multi-currency wallet model
**Why:** PRD lists JPY, TWD, USD, HKD across markets but doesn't define wallet semantics if a fan crosses regions.
**Scope:**
- Decide: per-fan single-currency lock vs multi-balance vs convert-at-spend.
- FX source + revaluation rules.
- Tax & receipt implications.
**Acceptance:**
- [ ] Decision documented as ADR.
- [ ] Reporting normalizes to USD for finance.
**Priority:** P1 · **Effort:** M · **PRD ref:** §17

---

## D. Trust, Safety & Crisis

### HID-028: Fan reporting mechanism
**Why:** Fan reports inappropriate twin behavior. Not in PRD; required for safety + trust.
**Scope:**
- "Report this response" button on every twin message.
- Categories (off-topic, abusive, inappropriate, fraud).
- Internal triage queue; auto-pause creator if threshold hit.
**Acceptance:**
- [ ] Report fires <2s, no UX block.
- [ ] Triage SLA: respond <24h.
**Priority:** P0 · **Effort:** S · **PRD ref:** §8

### HID-029: Creator-side fan blocking
**Why:** Creator has no defined way to block an abusive fan. Implicit need.
**Scope:**
- Creator can block fan from Hermes ("Block this fan").
- Block prevents chat + refunds remaining credits.
- Platform-wide ban list (HID-031) integration.
**Acceptance:**
- [ ] Block effective <5s on next fan request.
**Priority:** P0 · **Effort:** S · **PRD ref:** §5.5

### HID-030: Crisis intervention flow (self-harm, minor safety)
**Why:** Parasocial AI products attract distressed users. PRD does not address this; this is a launch-critical safety gap.
**Scope:**
- Detection model on inbound fan messages (suicidal ideation, self-harm, minor in distress).
- Twin response: empathetic redirect + region-appropriate hotlines (TELL Japan, Lifeline TW, Samaritans, 988).
- Soft-pause creator response if signals strong; alert internal safety queue.
- Locale-specific resources reviewed by counsel + clinicians.
**Acceptance:**
- [ ] Trigger words tested with clinical advisor.
- [ ] Hotline list reviewed JP/TW/HK/EN before launch.
- [ ] Audit log of every trigger; metrics on volume.
**Priority:** P0 · **Effort:** L · **PRD ref:** §8 (gap)

### HID-031: Platform-wide ban list
**Why:** Fans banned by one creator may re-pay with another. Coordinated abuse needs platform layer.
**Scope:**
- Soft (reported by N creators) and hard (platform action) tiers.
- Email + phone + device fingerprint matching.
**Acceptance:**
- [ ] Banned fans blocked from signup.
**Priority:** P1 · **Effort:** M · **PRD ref:** §8

### HID-032: Audit log infrastructure
**Why:** §8.3 mandates 12-month retention (5 years for financial). No system specified.
**Scope:**
- Append-only log: every consent action, every moderation block, every payout, every admin override.
- Immutable storage (S3/GCS object lock).
- Searchable for legal + ops.
- Tamper-evidence (hash chain).
**Acceptance:**
- [ ] Retention enforced.
- [ ] Sample DSAR / legal query answerable from log in <1h.
**Priority:** P0 · **Effort:** L · **PRD ref:** §8.3

---

## E. Compliance Scaffolding

### HID-033: Privacy policy / ToS versioning + re-acceptance
**Why:** Policies change; existing users must re-accept. Not addressed.
**Scope:**
- Versioned policy documents stored with hash.
- Per-user acceptance record (version, timestamp, IP).
- Re-acceptance gate on next login when material change.
**Acceptance:**
- [ ] Version history queryable per user.
- [ ] Material-change flag triggers re-accept.
**Priority:** P0 · **Effort:** S · **PRD ref:** §8.5

### HID-034: Cookie / tracking consent banner
**Why:** Fans arrive from social — including EU + UK traffic from day 1. APPI + PDPA also have consent semantics for analytics.
**Scope:**
- Region-aware banner (strictest applicable law).
- Per-category opt-in (necessary / analytics / marketing).
- PostHog + GA4 honor categories.
**Acceptance:**
- [ ] Consent state queryable in client SDK.
- [ ] No non-essential tracking before consent.
**Priority:** P0 · **Effort:** S · **PRD ref:** §8.5

### HID-035: DSAR self-service portal
**Why:** §16 promises 30-day fan DSAR; no intake exists.
**Scope:** See HID-017 — split into fan-self-service portal vs internal fulfillment.
**Acceptance:**
- [ ] Fan can download their own data without ticketing.
- [ ] Creator can self-export (72h per §16).
**Priority:** P0 · **Effort:** M · **PRD ref:** §16

### HID-036: Data residency enforcement
**Why:** §8.11 requires APPI/PDPA-compliant residency. Region-aware storage + query routing not designed.
**Scope:**
- DB partitioning or per-region cluster for personal data.
- Vector index per region.
- Provider selection gated on residency (e.g., reject ElevenLabs region if non-compliant).
- Documented data flow diagram per region.
**Acceptance:**
- [ ] JP fan PII never leaves JP region.
- [ ] TW fan PII never leaves TW/SEA-compliant region.
- [ ] Diagrams reviewed by counsel.
**Priority:** P0 · **Effort:** XL · **PRD ref:** §8.11, §16

### HID-037: Cross-border transfer logging
**Why:** APPI / PDPA require recordable lawful basis for cross-border PII transfer. Implied by §8.11.
**Scope:** Per-transfer log row (source region, dest region, lawful basis, data category, count). Annual report.
**Acceptance:**
- [ ] Provider API calls with PII produce log entry.
**Priority:** P0 · **Effort:** M · **PRD ref:** §8.11

### HID-038: Right-to-be-forgotten verification artifact
**Why:** §23.5 requires deletion be "complete and verifiable." Verification artifact not specified.
**Scope:** Signed report listing every system + provider where the user's data lived and confirmation of purge.
**Acceptance:**
- [ ] Report available to user on request.
**Priority:** P0 · **Effort:** S · **PRD ref:** §23.5

---

## F. Twin Engine — runtime gaps

### HID-039: Conversation history storage + context-window management
**Why:** §22.5 names it as a hard problem; no design.
**Scope:**
- Per-creator-per-fan rolling history.
- Summarization for long conversations (rolling window + extractive summary).
- Retention policy (default 12 months; configurable for §8.3).
- Export hooks for DSAR.
**Acceptance:**
- [ ] Context fits provider limits with summary fallback.
- [ ] Summarization quality A/B tested.
**Priority:** P0 · **Effort:** L · **PRD ref:** §22.5, §16

### HID-040: Twin per-fan memory
**Why:** "Feel close at 2am" (§1) implies the twin remembers individuals. Not specified.
**Scope:** Per-fan persistent facts (name, preferences, prior topics), retrieved into context. Fan can view/edit/delete.
**Acceptance:**
- [ ] Memory entries surfaced to fan in account.
- [ ] Deletion propagates within 60s.
**Priority:** P1 · **Effort:** M · **PRD ref:** §1, §5.2

### HID-041: Provider outage / graceful degradation
**Why:** §16 sets SLAs but no design for "GMI text is down."
**Scope:**
- Per-modality fallback chain (LiteLLM-style).
- Graceful messages: "twin is resting, try again in a few minutes" rather than 500s.
- Circuit breaker + auto-recovery.
**Acceptance:**
- [ ] Chaos test: kill primary provider, fallback engages <10s.
**Priority:** P1 · **Effort:** M · **PRD ref:** §11, §16

### HID-042: Twin sandbox / preview mode
**Why:** §14 Step 5 mentions "sample twin outputs in ~20 scenarios" — no tool spec.
**Scope:** Creator-facing chat with her own twin without billing or moderation alerts; persona changes preview live.
**Acceptance:**
- [ ] Creator can A/B her own persona in <5s round-trip.
**Priority:** P0 · **Effort:** M · **PRD ref:** §14

### HID-043: Persona / config version rollback
**Why:** A bad persona edit can ruin the twin. Not addressed.
**Scope:** Snapshot persona + config on every save; rollback button (last 30 versions).
**Acceptance:**
- [ ] Rollback restores in <30s.
**Priority:** P1 · **Effort:** S · **PRD ref:** §5.4

### HID-044: Per-fan rate limiting + jailbreak protection
**Why:** Free trial messages will be jailbreak-probed. Not addressed.
**Scope:** Per-fan-per-creator request quotas; jailbreak pattern detection; soft-block + warn before hard-block.
**Acceptance:**
- [ ] Known jailbreak prompts blocked.
- [ ] Genuine fans never hit limits.
**Priority:** P0 · **Effort:** M · **PRD ref:** §8

### HID-045: Creator visibility into fan conversations — policy + UI
**Why:** Sensitive question never resolved. APPI / PDPA implications.
**Scope:**
- Decide: aggregated only? full transcripts? top-fan transcripts only?
- Fan-facing disclosure must match what creator can see.
- Build UI to whichever policy is chosen.
**Acceptance:**
- [ ] Policy reviewed by counsel + signed.
- [ ] UI matches policy.
**Priority:** P0 · **Effort:** M · **PRD ref:** §5.4, §8.5

### HID-046: Inline AI disclosure injection
**Why:** §4 + §8.2 require "AI twin · @CreatorAI_bot" inline on every response. No technical spec.
**Scope:**
- Disclosure attached at delivery layer, not generation (cannot be jailbroken out).
- Locale-aware text.
- Renders correctly in web, Telegram (later P1), voice notes ("AI voice note from…"), video.
**Acceptance:**
- [ ] 100% of responses carry disclosure.
- [ ] Verified by automated tests.
**Priority:** P0 · **Effort:** S · **PRD ref:** §4, §8.2

---

## G. Content Engine

### HID-047: Asset CDN / storage tiering
**Why:** Voice/video/image assets accumulate; cost balloons. Not addressed.
**Scope:** Hot tier (recent 30d) + cold tier; signed URLs; per-creator quota visibility.
**Acceptance:**
- [ ] Cost per creator visible (feeds HID-019).
**Priority:** P0 · **Effort:** M · **PRD ref:** §22.1

### HID-048: Content version history
**Why:** Approval flow (§5.3) needs to track which version was approved vs delivered.
**Scope:** Immutable revision history per asset; approval references a specific version.
**Acceptance:**
- [ ] Auditable lineage approved-version → posted-version.
**Priority:** P0 · **Effort:** S · **PRD ref:** §5.3

### HID-049: Generated-content retraction on consent revoke — contradiction reconciliation
**Why:** §8.10 says revocation must "pull from all delivery channels in 60s." But §5.6 forbids posting/deletion on her social accounts. If she already posted, we can't retract.
**Scope:**
- Reconcile in PRD: revocation pulls from *7of1-controlled* channels only.
- Workflow nudges creator to delete from her socials manually + tracks compliance.
- Watermarking so creator can find posted versions.
**Acceptance:**
- [ ] PRD updated.
- [ ] Pull from 7of1 channels <60s.
- [ ] Creator-facing checklist for socials.
**Priority:** P0 · **Effort:** M · **PRD ref:** §8.10, §5.6

### HID-050: Social calendar backend
**Why:** §5.4 (P1) + §13 reference but don't detail.
**Scope:** Per-creator scheduling engine, per-platform best-time models, Hermes push.
**Acceptance:**
- [ ] Suggested schedule per week.
- [ ] Push approval at right time.
**Priority:** P1 · **Effort:** L · **PRD ref:** §5.4, §13

### HID-051: Posted-content performance tracking
**Why:** §5.4 P1 promises "what performed best." Without OAuth scope expansion, no signal.
**Scope:** Either (a) creator manually pastes metrics, or (b) expanded OAuth scope (re-consent), or (c) link tracking through `7of1.[tld]/[handle]?ref=ig`.
**Acceptance:**
- [ ] At least the link-tracking variant ships P1.
**Priority:** P1 · **Effort:** M · **PRD ref:** §5.4

---

## H. Hermes — ops gaps

### HID-052: Hermes channel failover
**Why:** Telegram outage = creator has no interface (§5.5).
**Scope:**
- Email digest fallback for critical events (kill-switch confirmation, payouts, content approvals).
- Status page link.
- SMS for sev-1 events.
**Acceptance:**
- [ ] Simulated Telegram outage: creator still receives kill-switch confirmations via fallback.
**Priority:** P1 · **Effort:** M · **PRD ref:** §5.5

### HID-053: Multi-channel account linking
**Why:** §17 lists Telegram + LINE for JP. PRD does not say a creator can have *both*.
**Scope:** Decide single-channel vs multi-channel per creator; if multi, fan-out logic for notifications.
**Acceptance:**
- [ ] Decision documented.
**Priority:** P2 · **Effort:** M · **PRD ref:** §17

### HID-054: Hermes audit log
**Why:** Creator deserves to know what Hermes did on her behalf. Not addressed.
**Scope:** "What Hermes did today" digest + on-demand log per creator.
**Acceptance:**
- [ ] Every Hermes action attributable.
**Priority:** P1 · **Effort:** S · **PRD ref:** §5.5

### HID-055: Hermes rate limiting / loop protection
**Why:** A misconfigured trigger could hammer the creator with notifications.
**Scope:** Per-creator notification budget per hour; coalescing; loop detection.
**Acceptance:**
- [ ] No creator receives >N pushes/hr without explicit opt-in.
**Priority:** P1 · **Effort:** S · **PRD ref:** §5.5

### HID-056: Hermes timezone + language preferences
**Why:** "Best time to post in JP" (§5.5) requires per-creator timezone. Language preference for Hermes itself never specified.
**Scope:** Captured at onboarding (Step 5, §14). Surfaces in nudges and digests.
**Acceptance:**
- [ ] Hermes addresses JP creator in JP, TW creator in ZH-TW.
**Priority:** P0 · **Effort:** S · **PRD ref:** §5.5, §14

### HID-057: Hermes prompt / persona versioning
**Why:** Hermes is itself an LLM agent. Its own system prompt has no owner.
**Scope:** Hermes prompts in version control; A/B framework; rollback path.
**Acceptance:**
- [ ] Hermes prompt changes are reviewable diffs.
**Priority:** P0 · **Effort:** S · **PRD ref:** §5.5

---

## I. Onboarding pipeline

### HID-058: Asset upload progress + resume
**Why:** §14 Step 1 has multi-video uploads on mobile in JP/TW. Not addressed.
**Scope:** Resumable uploads (tus.io or signed multipart); progress UI; offline resume.
**Acceptance:**
- [ ] 100MB video upload survives connection drop.
**Priority:** P0 · **Effort:** M · **PRD ref:** §14

### HID-059: Asset upload content moderation
**Why:** Someone uploads CSAM or non-consensual content. No screening defined.
**Scope:** Pre-acceptance scan (PhotoDNA / Cloud Vision SafeSearch / GMI moderation).
**Acceptance:**
- [ ] CSAM never reaches storage.
- [ ] Reports filed per legal requirement.
**Priority:** P0 · **Effort:** M · **PRD ref:** §14, §8

### HID-060: Onboarding save-and-resume
**Why:** "≤90 min" (§3) is not one sitting on a phone. Not addressed.
**Scope:** Per-creator onboarding state machine; resume from any step; partial save.
**Acceptance:**
- [ ] Creator can quit at any point and resume <1 click.
**Priority:** P0 · **Effort:** M · **PRD ref:** §3, §14

### HID-061: Creator invite / referral
**Why:** §9 says "17 Live brings creators." How they cross into 7of1 is unspecified.
**Scope:** Invite codes / one-time signup URLs; per-recruiter attribution; eligibility check.
**Acceptance:**
- [ ] Creator cannot self-signup without invite during launch period.
**Priority:** P1 · **Effort:** S · **PRD ref:** §9

### HID-062: Creator KYC + tax-form intake
**Why:** §8.6 implies; never specified as a flow.
**Scope:** Region-specific docs (JP マイナンバー if direct payout; W-8/W-9 for US; etc.). Goes with HID-014.
**Acceptance:**
- [ ] Payout cannot enable without complete intake.
**Priority:** P0 · **Effort:** M · **PRD ref:** §8.6, §14

---

## J. Operational

### HID-063: Public status page
**Why:** Incidents will happen. Creators + fans need a signal source. Not addressed.
**Scope:** Statuspage.io or Atlassian Statuspage; per-component (fan page, Hermes, payments).
**Acceptance:**
- [ ] Sev-1 posts within 5min of detection.
**Priority:** P1 · **Effort:** S · **PRD ref:** —

### HID-064: Feature flags + gradual rollout
**Why:** Slice-based shipping (§7) needs flag gating per creator / per region. Not addressed.
**Scope:** LaunchDarkly / Statsig / Unleash / open-source.
**Acceptance:**
- [ ] Per-creator overrides supported.
- [ ] No code deploy required to flip a flag.
**Priority:** P0 · **Effort:** S · **PRD ref:** §7

### HID-065: A/B testing framework
**Why:** Paywall variants, persona tweaks. Not addressed.
**Scope:** Statsig / GrowthBook / PostHog experiments; per-creator assignment isolation.
**Acceptance:**
- [ ] Experiment ID flows into Helicone + PostHog for downstream analysis.
**Priority:** P1 · **Effort:** M · **PRD ref:** §19

### HID-066: SLO monitoring + alerting
**Why:** §16 sets hard latency SLAs (200ms p95 text, 30s voice, 5min video, 500ms moderation, 60s revocation, 5s kill switch). No alerting layer.
**Scope:** Prometheus + Grafana or Datadog; per-SLO budget burn alerts; PagerDuty.
**Acceptance:**
- [ ] Every §16 SLA has a dashboard panel and an alert rule.
**Priority:** P0 · **Effort:** M · **PRD ref:** §16

### HID-067: Backup, DR, point-in-time recovery
**Why:** Persona data + creator content corpus is the moat (§23). Not addressed.
**Scope:** PITR on Postgres; object-store replication; quarterly restore drill.
**Acceptance:**
- [ ] RPO ≤ 15min, RTO ≤ 4h.
- [ ] Drill conducted before first paying creator.
**Priority:** P0 · **Effort:** M · **PRD ref:** §23

### HID-068: On-call rotation + paging
**Why:** Kill-switch SLA (5s) and consent revocation (60s) require 24/7 detection of failures. Not addressed.
**Scope:** PagerDuty rotation; runbooks; sev definitions.
**Acceptance:**
- [ ] Sev-1 paged 24/7 before launch.
**Priority:** P0 · **Effort:** S · **PRD ref:** §8.10, §19

---

## K. Social Comment / DM Assist (Slice 4 / P1)

### HID-069: OAuth token storage + refresh
**Why:** §5.6 needs per-creator OAuth tokens. Storage and refresh undefined.
**Scope:** Encrypted-at-rest tokens; per-provider refresh schedule; revocation handling.
**Acceptance:**
- [ ] Tokens rotated before expiry; failures notified to creator.
**Priority:** P1 · **Effort:** M · **PRD ref:** §5.6

### HID-070: Inbound ingestion (poll vs webhook) per platform
**Why:** IG/TikTok/X/YT each differ. PRD assumes ingestion without spec.
**Scope:** Per-platform ingestion adapter; rate-limit management; queueing.
**Acceptance:**
- [ ] Comments + DMs in queue <5min from receipt where API allows.
**Priority:** P1 · **Effort:** L · **PRD ref:** §5.6

### HID-071: Per-creator draft queue state machine
**Why:** Drafts → approval → send → confirmation lifecycle. Implied, not specified.
**Scope:** State machine; Hermes integration; bulk approve.
**Acceptance:**
- [ ] No draft sent without explicit creator action.
**Priority:** P1 · **Effort:** M · **PRD ref:** §5.6

### HID-072: Send-attestation log
**Why:** Legal defense — proof the creator pressed send, not 7of1.
**Scope:** Per-send audit row with creator session ID, IP, timestamp, draft hash.
**Acceptance:**
- [ ] Log defensible in regulatory inquiry.
**Priority:** P1 · **Effort:** S · **PRD ref:** §5.6, §8.1

### HID-073: OAuth scope-change re-consent flow
**Why:** Meta changes scopes regularly. Not addressed.
**Scope:** Detect scope change; force re-consent in Hermes before next send.
**Acceptance:**
- [ ] Stale-scope creators are paused, not silently broken.
**Priority:** P1 · **Effort:** S · **PRD ref:** §5.6

---

## Top-5 launch-blocking summary

If forced to prioritize the launch-critical subset:

| Rank | Ticket | Why it's launch-critical |
|---|---|---|
| 1 | **HID-001** Transactional email | Magic-link auth doesn't work without it |
| 2 | **HID-022** Tax collection | Legally mandatory for B2C digital in JP from yen 1 |
| 3 | **HID-021** Convenience-store pending UX | §17 requires it; no design exists |
| 4 | **HID-030** Crisis intervention | Parasocial AI without this ends up in headlines |
| 5 | **HID-010** Admin console scaffold | Day-1 ops, refunds, KYC, deletion all need it |

---

*Generated against PRD Draft v8 (2026-05-24). Re-audit when PRD is updated.*
