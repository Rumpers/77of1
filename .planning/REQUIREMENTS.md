# Requirements: lala.la

**Defined:** 2026-05-27
**Core Value:** A fan can open Telegram or `lala.la/[handle]`, have a convincing conversation with a creator's AI twin, and get nudged to her actual monetization platform — all within 30 seconds of first message.

## v1 Requirements

### Infrastructure

- [ ] **INFRA-01**: Platform runs on Replit with api-server (port 8080), web SPA (port 22333), and admin (port 3001) co-deployed without port mapping changes
- [ ] **INFRA-02**: Supabase client fully removed; all DB access goes through Drizzle + Replit PostgreSQL
- [ ] **INFRA-03**: Drizzle schema defines all core tables: `creators`, `twins`, `creator_kyc`, `consent_grants`, `conversation_messages`, `generation_jobs`, `safety_audit_log`
- [ ] **INFRA-04**: BullMQ queue (backed by Redis) processes async jobs: voice generation, consent revocation sweep

### Creator KYC / Personality Rights

- [ ] **KYC-01**: Twin chat route returns 423 until `creator_kyc.status = 'signed'` — strict positive assertion; null/unknown/pending all block with locale-appropriate error
- [ ] **KYC-02**: KYC agreement text explicitly names voice synthesis scope (likeness, duration, revocability) as a signed line item
- [ ] **KYC-03**: Creator can view KYC status via Lala bot at any time

### Creator Onboarding (Lala Bot)

- [ ] **ONBOARD-01**: Creator can complete no-tech onboarding via Lala Telegram bot: consent acceptance, persona intake, voice reference sample upload, character card generation
- [ ] **ONBOARD-02**: Creator can pause/resume twin via Lala bot (kill switch with ≤5s SLA from bot command to twin returning 503)
- [ ] **ONBOARD-03**: Creator can revoke voice consent via Lala bot; revocation triggers deletion sweep of all in-flight generation jobs within 60s SLA
- [x] **ONBOARD-04**: Founder review queue (Telegram) shows OCR-extracted fan-name masks with approve/reject action for uncertain masks

### Persona

- [ ] **PERSONA-01**: Twin personality stored as SillyTavern Character Card V2 JSON (Zod-validated JSONB) with fields: `name`, `description`, `personality`, `scenario`, `mes_example`, `first_mes`, `post_history_instructions`
- [ ] **PERSONA-02**: Twin constitution stored as a Markdown file per creator (not a DB table) for v1
- [ ] **PERSONA-03**: `twins` table has `visibility` column (`public` / `private`) to support future multi-twin per creator; active security isolation deferred

### Fan Twin Chat

- [ ] **CHAT-01**: Fan can open `lala.la/[handle]` and send a text message to the creator's AI twin
- [ ] **CHAT-02**: Fan can chat with the creator's AI twin via a Telegram fan-twin bot (separate bot from Lala)
- [ ] **CHAT-03**: Every chat session uses an HMAC-signed `conversation_id` validated at route entry; sessions without valid HMAC are rejected
- [ ] **CHAT-04**: Conversation history is loaded from DB per session; context window managed with truncation strategy (oldest messages dropped first when context limit approached)
- [ ] **CHAT-05**: Fan funnel page at `lala.la/[handle]` displays a soft CTA linking to the creator's monetization platform(s) (Fanvue / Patreon / 17 LIVE / personal site)
- [ ] **CHAT-06**: Telegram fan-twin bot webhook handler returns HTTP 200 before LLM processing begins; fan message is acknowledged immediately and processed asynchronously

### Voice

- [x] **VOICE-01**: Twin can reply with voice audio generated from creator's reference sample via GMI Cloud XTTS zero-shot voice synthesis
- [x] **VOICE-02**: Voice generation runs as an async BullMQ job; circuit-breaker fallback to text-only reply when GMI is unavailable
- [x] **VOICE-03**: Generated voice files stored in Replit Object Storage; fan receives a pre-signed URL with TTL

### Moderation Pipeline

- [ ] **MOD-01**: L1 — OpenAI moderation API runs on fan input before LLM call; blocked inputs receive locale-appropriate safe deflection
- [ ] **MOD-02**: L2 — Character Card V2 `post_history_instructions` field encodes persona safety guardrails injected into every LLM system prompt
- [ ] **MOD-03**: L3 — OpenAI moderation API runs on LLM output before delivery to fan; flagged outputs replaced with safe deflection
- [ ] **MOD-04**: L4 — Pre-canned safe deflection responses per locale (EN / JP / ZH-TW) served for all flagged turns
- [ ] **MOD-05**: L5 — High-risk flag triggers Sentry alert and Lala bot notification to founder within the request lifecycle
- [ ] **MOD-06**: L6 — Every flagged turn appended to `safety_audit_log` (hashed fan_id + message_hash; no raw PII stored)
- [x] **MOD-07**: Conversation-level escalation scoring detects gradual-escalation bypass patterns (Crescendo-style) across turns, not only per-message

### Compliance

- [ ] **COMPLY-01**: Every twin chat interaction begins with an AI disclosure statement per California SB 243 (effective 2026-01-01), in the fan's detected locale
- [ ] **COMPLY-02**: Self-harm category detected by OpenAI moderation triggers immediate crisis helpline injection in fan's locale: JP (よりそいホットライン 0120-279-338), TW (1925), HK (撒瑪利亞防止自殺會 2389 2222), EN (988 Lifeline)
- [ ] **COMPLY-03**: Fan conversation data minimized — no raw message content in logs or audit records; hashed identifiers only
- [x] **COMPLY-04**: Creator can request full data deletion (DSAR) via Lala bot; all twin conversation history and voice files deleted within 30 days

### Internationalization

- [x] **I18N-01**: All user-facing strings in web funnel (CTAs, disclosure, deflections) and Telegram bot messages available in EN, JP, and ZH-TW
- [ ] **I18N-02**: Fan locale detected from Telegram language setting or browser `Accept-Language`; defaults to EN when detection fails

### Evaluation

- [x] **EVAL-01**: 30-case eval suite per creator before go-live: 10 in-character, 10 boundary-push, 5 hard-limit, 5 prompt-injection; 100% pass rate on hard-limit and injection categories required
- [x] **EVAL-02**: Weekly regression cron re-runs eval suite; Sentry alert fires on any regression below 100% hard-limit pass rate

---

## v2 Requirements

### Streaming

- **STREAM-01**: Fan chat responses delivered via SSE (Server-Sent Events) for real-time streaming effect

### Channels

- **CHAN-01**: Fan can chat with twin via LINE (Japan market)
- **CHAN-02**: Fan can chat with twin via WhatsApp

### Memory

- **MEM-01**: Creator's twin uses Graphiti + Neo4j long-term memory (activate at creator #3-5)

### Attribution

- **ATTR-01**: 17 LIVE webhook captures fan-to-creator revenue events attributed to twin interactions
- **ATTR-02**: Patreon webhook captures fan subscription events attributed to twin interactions
- **ATTR-03**: Fanvue webhook captures fan subscription events attributed to twin interactions

### Image Generation

- **IMG-01**: Twin can generate in-character images via Illustrious XL + creator LoRA (Phase 5+; requires TAKE IT DOWN Act CSAM filter)

### Multi-Twin Security

- **TWIN-SEC-01**: Row-level security enforces multi-twin isolation per creator (`app.current_twin_id` context variable)

### Compliance — Age Detection

- **AGE-01**: Fan session flagged as potential minor triggers SB 243-mandated 3-hour break reminder

### Session Persistence

- **SESSION-01**: Hermes consent sessions persisted to PostgreSQL via `@telegraf/session/pg` (currently in-memory — survives restarts)

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Fan payment loop | Product charges creators flat fee; no fan payment ever — locked decision |
| Stripe Connect | Fan payment scaffold from prior direction; stays dormant in git history |
| Fan accounts / fan auth | No fan accounts; anonymous sessions only |
| 5 background AI agents (beyond Lala) | Founder operates as all agents at N=1; no automation budget |
| Apple VisionKit on-device masking | Server-side OCR + blur is the approach; VisionKit deferred |
| `twin_constitutions` DB table | Markdown file sufficient for v1; table added in v2 |
| AI image generation (v1) | Phase 5+ only; requires TAKE IT DOWN Act compliance gating |
| Romantic/intimate relationship framing | FTC complaint risk + EU pressure (see Replika); parasocial-friendship framing only |

---

## Traceability

All 38 numbered v1 requirements are delivered (v1.0 Launch Sprint complete 2026-05-30). Phase 2 and Phase 3 items are code-complete; live execution / founder runtime UAT is still outstanding (see `.planning/STATE.md` → Blockers/Concerns).

**Out-of-traceability gap:** the self-service **web DSAR portal** (`routes/dsar.ts` + `dsar-portal.tsx`/`fan-dsar.tsx`) and **email suppression-log writes** (`routes/email-webhooks.ts`) remain `PHASE_1_STUB` 503s — never restored in Phase 2 as their comments promised. These are not covered by a numbered requirement (COMPLY-04 covers only the creator *bot* DSAR path, which IS complete). Tracked as a v1.0 follow-up.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-03 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| KYC-01 | Phase 1 | Complete |
| KYC-02 | Phase 1 | Complete |
| KYC-03 | Phase 2 | Complete |
| ONBOARD-01 | Phase 2 | Complete |
| ONBOARD-02 | Phase 2 | Complete |
| ONBOARD-03 | Phase 2 | Complete |
| ONBOARD-04 | Phase 3 | Complete |
| PERSONA-01 | Phase 2 | Complete |
| PERSONA-02 | Phase 2 | Complete |
| PERSONA-03 | Phase 1 | Complete |
| CHAT-01 | Phase 2 | Complete |
| CHAT-02 | Phase 2 | Complete |
| CHAT-03 | Phase 2 | Complete |
| CHAT-04 | Phase 2 | Complete |
| CHAT-05 | Phase 2 | Complete |
| CHAT-06 | Phase 2 | Complete |
| VOICE-01 | Phase 3 | Complete |
| VOICE-02 | Phase 3 | Complete |
| VOICE-03 | Phase 3 | Complete |
| MOD-01 | Phase 2 | Complete |
| MOD-02 | Phase 2 | Complete |
| MOD-03 | Phase 2 | Complete |
| MOD-04 | Phase 2 | Complete |
| MOD-05 | Phase 2 | Complete |
| MOD-06 | Phase 2 | Complete |
| MOD-07 | Phase 3 | Complete |
| COMPLY-01 | Phase 2 | Complete |
| COMPLY-02 | Phase 2 | Complete |
| COMPLY-03 | Phase 1 | Complete |
| COMPLY-04 | Phase 3 | Complete |
| I18N-01 | Phase 3 | Complete |
| I18N-02 | Phase 2 | Complete |
| EVAL-01 | Phase 4 | Complete |
| EVAL-02 | Phase 4 | Complete |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0 ✓
- Complete: 38/38 numbered requirements ✓ (plus one untracked gap: web DSAR portal + email suppression still stubbed — see note above)

---
*Requirements defined: 2026-05-27*
*Last updated: 2026-05-30 — all v1 requirements marked Complete (v1.0 Launch Sprint done; founder UAT pending)*
