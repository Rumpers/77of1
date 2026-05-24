# 7of1 — Product Requirements Document (v1)

**Status:** Draft v8 (§8, §16, §17 updated — 15 CTO review changes applied per [OF-17](/OF/issues/OF-17), [OF-14](/OF/issues/OF-14) HK decision incorporated, 2026-05-24)
**Tagline:** *7 days, always with you.*
**One-liner:** Off-platform monetization for live-streaming creators — an always-on AI twin in the creator's own voice, on a hosted fan page reachable from any social bio link, managed through a personal AI agent that works on her terms.

> **Architecture:** 7of1 is a **framework/scaffolding**. Underneath: swappable AI providers — GMI Inference models first, then best-in-class external providers where GMI doesn't yet have coverage. Above: a granular consent layer, a template/orchestration engine, and fan-facing surfaces. The moat is the framework, the consent infrastructure, the per-creator data, and the 17 Live distribution — not any single model.

> **Scope:** v1 is full multimodal from launch — text, voice, video, shareable-content engine, creator-chosen monetization, and the Hermes creator agent. §7 specifies a thin-slice build order within P0 — sequencing, not scope reduction.

---

## 1. Problem

Live-streaming creators (17 Live's ~100k streamers) monetize the fans who show up *live* via gifting. But their larger audience lives on IG / TikTok / Facebook / X, where it generates **zero revenue**. That off-platform audience:

- Can't easily be converted (downloading a livestreaming app to follow one creator is high-friction)
- Only engages when the creator is live (a few hours/week out of 168)
- Has real intent and willingness to pay, with nowhere to spend it

The gap isn't just a missing paywall — it's a missing 24/7 interactive presence. A fan wants to feel close to the creator at 2am. The creator wants to earn without being present. There's nowhere for that to happen today.

For the creator: income is unstable, capped by live hours, and entirely dependent on physical presence. When the stream ends, connection and income stop.

**7of1 closes the gap:** an AI digital twin of the creator — always on, in her own voice — reachable via her web fan page or a creator-branded Telegram bot. Fans pay for access and exclusive interaction. Creators earn while offline, managed through a personal AI agent (Hermes) that works on their terms.

---

## 2. Goals & Non-Goals

### Goals (v1)

1. Every creator gets a hosted, branded fan page reachable from any social bio link, **plus a creator-branded Telegram bot** where fans can interact with the AI twin and pay — same twin, two surfaces, fully managed by 7of1.
2. The fan page and Telegram bot are powered by an **AI digital twin** — the primary fan-facing product, trained on the creator's own voice, persona, and content. Twin character is defined via a **7-field setup** (Greeting style, Fan terms of endearment, Emoji usage, Bounds/hard-stops, Treatment style, Personality traits, Message style) with an **explicit intensity dial** (Warm → Intimate → Explicit) the creator sets at onboarding and can adjust anytime.
3. Fan interaction is monetized via creator-chosen model (subscription, credits, or hybrid) on both surfaces.
4. The system generates shareable content the creator posts to her socials to drive new fans to the bio link or Telegram bot (the acquisition flywheel).
5. Creator payout through 17 Live's existing flow — no second paycheck.
6. **JP/TW/SEA + EN**: JP, ZH-TW, and English all supported at launch. English required for SEA and global reach.
7. Creator retains full control: **Boundaries** (hard-stop list — topics, words, or request types the AI never crosses regardless of fan pressure), **intensity dial** (Warm → Intimate → Explicit), interaction limits, kill switch, content approval, data deletion.
8. Each creator gets a **Hermes agent** — the `7of1_bot` on Telegram, per-creator data-isolated — that manages her 7of1 presence (dashboard, approvals, fan bot config, analytics) through conversation. Hermes is creator-only. Creators never manage bot tokens.

### Non-Goals (v1 — explicitly out)

| What | Why it's out |
|---|---|
| **Autonomous** posting, replying, or DMs on creator's main social accounts without her review | Hard safety rule. Any comment/DM drafting is assisted + creator-approved before anything is sent. |
| Building our own foundation model or voice model | GMI inference portfolio first; orchestrate external providers where GMI doesn't cover. |
| AI-generated content without explicit per-modality consent grant | Video, voice, image each require their own individually-signed consent (§12). |
| Native mobile app | PWA first. |
| **Platform-level explicit content infrastructure** (NSFW CDN, age-gate stack, explicit moderation pipeline) | Not needed. Creator controls tone; platform doesn't police. Lives on web + Telegram, not app stores. |
| Deep in-app integration into 17 Live app | Distribution + payout only. Not co-mingled codebase. |
| **Dark-pattern free trial** (auto-converts with a 1–2 hour cancel window, no reminder) | Deliberately avoided. Fans choose to subscribe; no bait-and-switch billing. |
| **Direct-card-per-PPV** (3DS authentication on every micro-transaction, like Fanvue) | Credits/wallet model only. Fans pre-buy credit packs; no per-interaction card friction. |

---

## 3. Target Users

| Role | Description | Jobs to be Done |
|---|---|---|
| **Creator ("the streamer")** | 17 Live streamer, JP/TW/SEA/EN. Non-technical. Time-poor. Off-platform social following larger than live audience. | Earn without streaming more. Never risk main accounts. Manage everything via Hermes on Telegram. Onboard ≤90 min — no tokens, no dev setup. |
| **Fan ("the supporter")** | Follows creator on social. Mobile-first. May never have opened 17 Live. Conditioned to tip/gift. | Feel close to creator anytime. Chat with AI twin via web or creator Telegram bot. Pay for deeper access, exclusive replies, attention. |
| **17 Live (the channel)** | Recruits creators, handles payout, lends brand trust. | Grow creator GMV. Increase stickiness. Bridge fans to live streams. |

---

## 4. The Core Loop

```
Fan sees creator on IG/TikTok/X
   → taps bio link
   → lands on creator's 7of1 web fan page  ─OR─  opens creator's Telegram bot (@CreatorAI_bot)
   → tries the AI twin free (limited messages)
   → paywall: buys credits / subscribes (local payment rails, both surfaces)
   → keeps chatting; twin escalates naturally — text → voice note → personal PPV offer inside the DM
        ("I made something just for you" — fan unlocks with credits, no hard interrupt wall)
   → returns over days; some graduate to 17 Live live streams
   [All AI responses carry inline disclosure: "AI twin · @CreatorAI_bot"]

Meanwhile:
Twin interactions → generate anonymized shareable content
   → Hermes (7of1_bot, creator-only, per-creator data-isolated) notifies creator
   → creator approves with one tap in Telegram
   → creator posts to her socials (her hands, her account)
   → drives new fans to bio link / Telegram bot → loop repeats

Creator management layer (Hermes only):
Hermes monitors web + Telegram bot activity, revenue, content queue
   → pushes weekly summaries and nudges via Telegram
   → handles approvals, config changes, tone settings, analytics via conversation
   → creator never needs to open a web dashboard
   → creator never holds or manages any bot tokens — 7of1 manages all infrastructure
```

**The two metrics that prove the loop works:**
1. **First-paid → second-paid conversion** — target floor: **>30%.**
2. **Creator content-share rate** — target: **>50% of generated shareables posted within 7 days.**

---

## 5. Product Surfaces

### 5.1 Fan Page — P0

- `7of1.[tld]/[handle]` — short, per-creator URL.
- **Must work inside IG/TikTok in-app browsers.** Clean "open in browser" escape for payment.
- First screen: creator's face/brand, 5-second pitch, chat input. Fan sends first message **before** signup.
- Per-creator branding/theming. Each page feels like *hers*.
- Free trial messages → paywall → buy credits / subscribe.
- PWA. Mobile-first. **Supports EN / JP / ZH-TW** — fan page language auto-detected from browser locale; creator can set which languages the twin serves.

### 5.2 AI Twin Engine — P0 (the moat)

- **Per-creator RAG** over uploaded content + structured persona/system prompt.
- **Source-cited responses:** when twin references something the creator actually said, it surfaces grounding.
- **Voice notes (P0):** async, creator's cloned voice. "Recording a voice note…" — never blocking.
- **Talking video (P0, consent-gated):** avatar of creator speaking, enabled only with Talking Video consent grant (§12). Async, credit-gated.
- **Per-creator config:** tone, allowed/forbidden topics, hard-no list, response length, languages served, signature phrases, spice ceiling, modalities enabled.
- **Outbound moderation** on every response (text + voice transcript + video script). No exceptions.
- **Languages:** EN + JP + ZH-TW at launch minimum.
- **GMI inference models first** for text/persona; external providers where GMI doesn't cover (see §15).

### 5.3 Shareable Content Engine — P0 (the acquisition flywheel)

- Auto-generates vertical share-ready assets from twin activity: highlight cards, "top fan questions this week," quote cards, milestone celebrations — formatted for IG Story / Reels / TikTok.
- **Hermes pushes content approval requests** to creator's preferred channel. Creator approves with one tap; approval step nudges variation ("swap the background?").
- Approved clip is dual-purpose: social acquisition + fan page free/sample item. Premium version (extended, catwalk cut) costs fan credits.
- **She posts it herself** from her account. 7of1 never touches her main account.
- Fan privacy: genuinely anonymized; PII stripped before generation; legal review JP/TW/HK/EN before launch.

### 5.4 Creator Dashboard — P0 (lean) → P1 (rich)

The dashboard exists for creators who want a full web view. But most creator interaction happens through **Hermes** (§5.5) — the dashboard is the power-user layer, not the primary interface.

**P0 (launch — also accessible via Hermes commands):**
- Twin config + limits + modality toggles
- Revenue view (daily/weekly GMV, top interactions)
- Content-approval queue
- Kill switch (immediate, no confirmation gate)
- Data controls (export, delete)
- Consent grants management (§12)

**P1 (post-launch):**
- **Social media calendar** — AI-generated posting schedule for 7of1 shareables across her social channels. Shows what to post, when, in what format, with one-tap approve → share flow. Optimizes posting times per platform per region (JP prime time ≠ TW prime time).
- **Content pipeline view** — what is generating, what is in approval, what has been posted, what performed best.
- Fan engagement CRM: whale identification, churn signals, upcoming fan birthdays, engagement trends.
- **Comment/DM draft assist** (see §5.6) — AI-drafted replies to her social comments and DMs, presented for her review and one-tap send. She approves; she sends.
- Content insights: "fans asked about X 200×; here's a Reel script."
- Top-fan surfacing for personal replies from the creator herself.

### 5.5 Hermes Creator Agent — P0

**The interface layer that makes creator work frictionless.**

Each creator gets their own Hermes — a personal AI agent that manages her 7of1 presence through her preferred messaging channel. The goal: a creator should be able to run her entire 7of1 operation from her phone's messaging app without ever opening a dashboard.

**Communication channels (creator picks at setup):**
- Telegram (primary; richest bot API; best for notification + approval flows)
- 17 Live app internal messaging (if 17 Live exposes a webhook/bot API)
- WhatsApp Business API
- LINE (critical for JP market — LINE Official Account API)

**What Hermes does:**

| Function | Example |
|---|---|
| Content approval | "Your weekly highlight reel is ready. [Preview] Approve / Edit / Skip" |
| Revenue nudges | "You've earned ¥18,400 this week. Top fan: [anonymized]. 3 fans haven't returned in 7 days." |
| Posting nudges | "Best time to post in JP is in 2 hours. Your approved IG Story is queued. Want me to remind you?" |
| Config changes | "Set my forbidden topics: no politics, no relationship questions" — Hermes updates twin config |
| Performance summaries | Weekly digest: earnings, top interactions, content share rate, fan growth |
| Alerts | "Your twin was asked about [topic] 47× today — might be worth a post" |
| Kill switch | "Pause my twin" → twin paused within seconds |
| Onboarding handhold | Walks the creator through the 5-step setup via conversation |

**What Hermes does NOT do autonomously:**
- Post to her social accounts — it prepares; she posts.
- Reply to her social comments/DMs — it drafts; she sends (see §5.6).
- Change consent grants — these require explicit re-confirmation.
- Spend or move money — any payout action requires her confirmation.

**Technical implementation:** Hermes is a Paperclip-style agent per creator, running on the platform's agent infrastructure. Each creator's Hermes has read/write access to her 7of1 config and data, but no access to her external social accounts beyond what she explicitly grants via OAuth. The agent is scoped to 7of1's own surfaces.

### 5.6 Social Comment & DM Assist — P1

Creators spend significant time managing comments and DMs on their social posts. 7of1 can help — with important constraints.

**What we can do (official API, creator OAuth, creator-approved):**

| Platform | Comments | DMs | API Status |
|---|---|---|---|
| Instagram Business | Read + draft replies via Graph API | Draft replies via Instagram Messaging API (business accounts, restricted access required) | Generally available for business accounts |
| TikTok | Read + draft replies via TikTok Research/Business API | Not available via public API | Comment read/draft available; DMs not |
| X (Twitter) | Read + draft replies via X API v2 | Draft replies via DM API | Rate-limited; costly |
| YouTube | Read + draft replies via Data API | N/A | Available |

**How it works:**
1. Creator connects their social accounts via official OAuth (their consent, their credentials).
2. 7of1 reads incoming comments and DMs periodically.
3. AI generates draft replies in her voice (using the same twin persona/RAG as her fan page).
4. Drafts appear in her dashboard and are pushed to Hermes for review.
5. She reviews, edits if needed, and **taps to send** — from the 7of1 interface, via the platform API, authenticated as her.
6. Nothing is ever sent automatically. Every send is creator-initiated.

**The critical safety constraint:** 7of1 drafts; the creator sends. This is the line between "AI assist on her own accounts" (acceptable with consent and oversight) and "autonomous operation of her accounts" (§8 hard rule, never). The OAuth scopes we request must be exactly what is needed — no broader.

**Why this is worth doing:** Creators with large followings get hundreds of comments per post. Replying to fans is how parasocial bonds deepen. Most creators can't keep up. AI-drafted replies in her voice, reviewed by her, sent by her — this is a meaningful time saver and a fan retention tool.

**Priority:** P1. Requires platform API approval processes (especially Instagram DM API) that have lead times. Start the approval process in parallel with Slice 1 build.

---

## 6. Monetization Detail

**Creator-chosen model per page:**

| Model | Description | Best for |
|---|---|---|
| Subscription-only | Flat monthly VIP access (~¥500–1,500/mo equiv) | Broad, lower-intensity fanbases |
| Credits-only | Fans buy credit packs (~¥500 / ¥2,000 / ¥5,000); spend per interaction | Whale-heavy fanbases; maps to gifting behavior |
| Hybrid | Base subscription + credits for premium interactions | Default recommendation; captures casuals + whales |

**Design implications:**
- Config schema must include monetization model + parameters as P0.
- Fan page renders differently per model — different paywall, different CTAs.
- Platform-defined price bounds (min/max). Creators choose within bounds.
- Reporting normalizes across models.

**Revenue split:** 80/20 creator/platform (target, before processing). 17 Live cut from platform share. Same split regardless of model.

**Credit-consuming premium interactions:**
- Voice notes
- Talking video replies (HeyGen/GMI, consent-gated)
- Full-body/catwalk clips (Kling, highest consent gate)
- Priority/"real reply" tier
- Custom content requests
- AI-drafted social comment/DM replies (P1, small credit cost or included in subscription)

---

## 7. P0 Build Order (Thin Slice First)

Everything in §5 is P0 scope. This is sequencing, not scope reduction.

**Slice 1 — the spine (prove a fan will pay twice):**
Text twin + fan page (IG-webview-safe) + EN/JP/ZH-TW locale support + per-creator persona/limits config + one monetization model end-to-end + payout path. Get one design-partner creator's fans converting and returning.

**Slice 2 — creator control + Hermes + flywheel:**
Full per-creator config (all three monetization models, modality toggles) + shareable-content engine + creator dashboard P0 + Hermes agent on Telegram + content approval/share flow. Creator runs her whole operation from Telegram.

**Slice 3 — voice + video + remaining rails:**
Voice notes (async, JP/ZH quality validated) + talking video replies (consent-gated) + additional payment rails + social calendar P1 + outbound moderation on voice/video.

**Slice 4 — social assist (P1):**
Comment/DM draft assist + fan CRM + social calendar full implementation. Platform API approvals running in parallel from Slice 1.

---

## 8. Safety, Compliance & Trust (Non-Negotiable)

1. **Never autonomously post, reply, or DM on creator's main social accounts.** AI can draft; creator sends. This applies to comments and DMs too (§5.6).
2. **AI disclosure.** Twin and Hermes are clearly AI. Platform requirement in JP/TW and increasingly a legal requirement.
3. **Per-creator limits enforced on every message.** Outbound moderation on all twin output, with audit log. Audit logs retained for a minimum of 12 months, or longer as required by applicable law (APPI: currently 5 years for financial records).
4. **Creator control:** one-click kill switch; one-click data deletion; approval gate on all public-facing content.
5. **Fan privacy:** anonymized content; PII stripped before generation; clear ToS + opt-out; JP/TW/HK/EN counsel review. HK is a planned Day-2 market; counsel review covers cross-border compliance and future HK launch readiness — HK is not a Day 1 launch market.
6. **Personality rights agreements** per creator — APPI (JP) / PDPA (TW) — before onboarding creator #1.
7. **Payments integrity:** never handle raw card data beyond processor requirements; tested refund/failure flows; fraud limits.
8. **OAuth scope minimization:** for social comment/DM assist, request exactly and only the scopes needed. No broad account access.
9. **Agent guardrails:** Hermes and any internal agents have consequential actions (sends, posts, spends) gated behind creator confirmation.
10. **Revocation SLA.** Revoking any consent grant must cancel in-flight generation jobs and suppress or pull queued content from all delivery channels within 60 seconds. This is a system-level constraint enforced at runtime, not a policy promise.
11. **Data residency.** Creator persona data (conversation history, LoRA adapters, RAG index, consent records, fan interaction logs) must be stored in jurisdictions compliant with APPI and PDPA. Cross-border transfer of personal data requires an explicit lawful basis per applicable law. Provider selection must respect this constraint.
12. **Minor protection.** AI twin interaction features involving purchases are restricted to users 18+. Age gate enforced at fan account registration. Market-specific requirements (e.g., stricter JP/TW rules) may require re-verification at payment initiation. No personal data from users under 16 may be retained beyond the session.

---

## 9. Dependencies & Open Questions

### Dependencies

| Dependency | Blocks | Status |
|---|---|---|
| 17 Live partnership terms | All creator onboarding | Not started |
| Revenue split (80/20 target) | Creator onboarding | Not started |
| Legal review JP/TW/HK/EN — PII, personality rights | Launch | Not started |
| GMI inference portfolio assessment — which capabilities are available? | Provider strategy | Needs internal review |
| Voice provider bake-off (JP/ZH quality) | Slice 3 voice | Not started |
| Payment rail setup — LINE Pay, JCB | Slice 2/3 payments | Long lead times; start early |
| Instagram DM API access approval | Slice 4 social assist | Apply at Slice 1; long process |
| Hermes channel API setup — Telegram Bot, LINE Official Account | Slice 2 | Moderate lead time |
| 17 Live creator recruitment / BD | First creator onboarding | In discussion |

### Open Questions

1. **GMI inference portfolio:** what models does GMI currently have that could substitute for OpenAI, ElevenLabs, HeyGen, Kling in the provider layer? This should be assessed before finalizing the provider strategy.
2. **Brand:** keep "7of1" globally, or localized names per region?
3. **Exclusivity:** exclusive to 17 Live creators, or open after a head-start window?
4. **Data ownership:** fans sign up to *7of1* — the fan relationship/data is ours. Confirm this is the agreed model.
5. **Hermes naming:** is "Hermes" the internal codename only, or is this the creator-facing name for the agent? Does each creator's agent get a custom name?
6. **LINE Official Account:** should Hermes run as a single 7of1 LINE account that creators follow, or per-creator LINE bots?
7. **Comment/DM assist scope at launch:** Instagram Business comments only (cleanest API), or aim for multi-platform from day one?
8. **NSFW policy:** if creators push for spicier limits, what's the legal/payment-processor reality?
9. **80/20 viability:** confirm the split works after 17 Live cut + payment processing.

---

## 10. What Winning Looks Like

7of1 wins on nine moats:

1. **17 Live distribution** — warm access to ~100k creators; no cold-start problem
2. **JP/TW/SEA + EN localization depth** — languages, payments, parasocial norms Western players don't serve
3. **Fan-product, not creator-tool** — the twin is the product fans pay for; Fanvue AI helps creators answer DMs. Different retention mechanic.
4. **Per-creator authentic-voice AI** — recognizably *her*, source-cited, consent-gated, trained on her corpus
5. **Hermes + zero-infra onboarding** — `7of1_bot` on Telegram, fully managed; creator never touches tokens or dashboards; Fanvue requires web setup
6. **Two fan surfaces (web + Telegram), fully managed** — meets fans where they are; creator just connects her bio link
7. **Message-level AI disclosure** — inline on every response ("AI twin · @CreatorAI_bot"); Fanvue only shows a profile badge. Builds trust, reduces regulatory risk.
8. **Credits wallet, not card-per-PPV** — fans pre-buy credits once; no 3DS friction per interaction. Fanvue charges card per PPV; we enable micro-transactions that feel frictionless.
9. **Refund-friendly billing** — fan can request a refund on an interaction that felt wrong. Fanvue's policy: "cannot reverse once processing." Our policy: 7-day goodwill refund on unused credits, review on others. Converts anxious first-buyers.

**The validation milestone:** ~1,000 creators active and earning, paying fans returning to interact with the twin across web and Telegram, creators managing via Hermes.

---

## 11. Architecture — The Framework / Scaffolding

```
┌─────────────────────────────────────────────────────────────┐
│  SURFACE LAYER                                               │
│  Fan page · Creator dashboard · Hermes agent (Telegram/      │
│  LINE/WhatsApp) · Social comment/DM assist interface         │
├─────────────────────────────────────────────────────────────┤
│  ORCHESTRATION + TEMPLATE LAYER                              │
│  Routes requests → checks consent + tier → picks provider →  │
│  assembles output → applies per-creator variation →          │
│  drops into approval queue → notifies via Hermes             │
├─────────────────────────────────────────────────────────────┤
│  PERMISSION / CONSENT LAYER                                  │
│  Per-creator granular consent gates, signed + versioned +    │
│  revocable. CHECKED LIVE AT GENERATION TIME.                 │
├─────────────────────────────────────────────────────────────┤
│  PROVIDER LAYER                                              │
│  GMI inference models (first preference, all categories) ·   │
│  HeyGen (talking video) · Kling/fal.ai (full-body motion) ·  │
│  ElevenLabs (voice) · open-source fallbacks · LLM for text   │
└─────────────────────────────────────────────────────────────┘
```

### Provider Layer — GMI First Policy

**GMI Inference portfolio is the first evaluation for every provider slot.** Before committing to an external provider, check if GMI has a capability that covers it. Benefits: internal alignment, lower unit cost, better customization, reduced external dependency.

| Capability | GMI First? | External Fallback |
|---|---|---|
| Text / persona / RAG (LLM) | **Yes — evaluate GMI LLM offering** | GPT-4o + Claude Sonnet (multi-provider) |
| Voice cloning | **Yes — evaluate GMI voice capability** | ElevenLabs; open-source (Coqui) |
| Talking video | **Yes — evaluate GMI video capability** | HeyGen |
| Full-body / motion video | **Yes — evaluate GMI video capability** | Kling via fal.ai/PiAPI |
| Image generation | **Yes — evaluate GMI image capability** | SD+LoRA per creator |
| Moderation | **Yes — evaluate GMI moderation** | Azure Content Safety (JP/ZH) |

External providers are the fallback when GMI doesn't have coverage or when the external quality bar significantly exceeds GMI's current capability in a specific modality (especially JP/ZH voice and video).

**Why agnostic architecture still matters even with GMI first:** GMI's portfolio will evolve. The provider-adapter interface means swapping in new GMI models as they ship requires no architectural change — just a new adapter.

---

## 12. Consent & Service Tier — Two Independent Axes

### Axis 1 — Consent Grants

| Grant | Permits | Risk Level |
|---|---|---|
| Persona / text | Train on captions/messages → twin talks like her | Low–Medium |
| Voice model | Clone her voice → TTS / voice notes | Medium |
| Image model | Train on photos → generate still images | Medium |
| Talking video | Generate video of her speaking (lip-sync) | High |
| Full-body / motion | Generate her body in motion (things she never did) | Highest |
| Social access (OAuth) | Read and draft replies on her social accounts | Medium (scoped) |

**Hard rules:**
- Default = nothing granted. Explicit opt-in for each.
- Consent checked **live at generation time**. Revocation pulls existing content.
- A grant for one modality is never implied consent for another.
- Social OAuth scopes requested only for explicitly granted functions.
- Counsel review before creator #1.

### Axis 2 — Service Tier

| Tier | What 7of1 Does | Hermes Involvement | Price |
|---|---|---|---|
| DIY / self-serve | She uploads assets; system builds models; she configures via Hermes or dashboard | Hermes handles all notifications + approvals | Lowest (rev-share) |
| Managed (monthly) | 7of1 actively builds content, scripts campaigns, keeps twin fresh | Hermes + human account manager | Higher |
| Concierge | Full white-glove — 7of1 runs her entire AI fan presence | Dedicated Hermes + dedicated manager | Premium |

---

## 13. Content & Template Engine

Templates = structure + slots + requirements. Engine fills slots with creator's consented assets. Graceful degradation when a slot's required consent is not granted.

**The variation safeguard (system requirement):** identical output across 100k creators = IG/TikTok algorithmic suppression + authenticity collapse. Skeleton shared; surface varied per creator. Hermes nudges variation at approval time ("swap the background or tweak the caption?").

**Output dual-purpose:** same clip → her social (acquisition) + fan page free sample. Premium version (extended, catwalk) costs credits.

**Social calendar integration (P1):** template engine outputs a suggested posting schedule per creator, per platform, per week — timed to her audience's active hours in her region. Hermes delivers the schedule via preferred channel and pushes individual posts for approval at the right time.

---

## 14. Onboarding & Twin-Production Pipeline

~15 minutes of creator time. Assets already exist on her phone.

**Step 1 — Asset upload (≈2 min):**
- 5–25 photos → image model + Kling motion reference
- 2–3 short talking videos → HeyGen/GMI avatar AND ElevenLabs/GMI voice clone (voice comes free from same upload)
- Optional: one 2–5 min video for hyper-realistic avatar tier

Uploaded assets are stored encrypted at rest in a **consent-pending state**. No AI processing (RAG embedding, voice cloning, LoRA training, avatar generation) begins until Step 3 consent is completed and countersigned. The twin-production pipeline is gated by consent signature, not asset receipt.

**Step 2 — Text/persona capture (do not skip):**
Photos + video give look + voice; not how she talks in writing. Pull public captions via official IG Graph API (her OAuth, no scraping). **EN/JP/ZH-TW examples included — creator picks her primary interaction language.**

Persona exercise: 8–12 scenario prompts covering fan compliments, fan questions, boundary-pushing messages, and multi-language examples. Creator types or voice-inputs her responses. Responses are processed into the persona system prompt and stored in the creator content corpus. Minimum: 8 scenarios completed before twin production is triggered.

**Step 3 — Consent (the one deliberate moment):**
Each §12 grant explicit and individually toggled. This step is deliberately NOT frictionless. It is the legal load-bearing wall.

Consent signature triggers twin production pipeline initiation. Assets uploaded in Steps 1–2 are released to processing queues only after this signature is received.

**Step 4 — Limits & config:**
Tone, topics, hard-no list, languages, spice ceiling, modalities, monetization model.

**Step 5 — Hermes setup + review:**
Creator connects her preferred messaging channel (Telegram/LINE/WhatsApp). Hermes walks her through sample twin outputs in ~20 scenarios. She edits/approves. Goes live. Hermes is her ongoing interface from here.

---

## 15. Provider & Build Strategy

### What We Build

| What | Why |
|---|---|
| 4-layer framework (Surface / Orchestration / Consent / Provider) | Scaffolding for 100k creators without 100k custom builds |
| Per-creator persona + RAG orchestration | No provider sells "sound like this creator" |
| Fan page PWA | UX differentiator; per-creator branding |
| Hermes agent per creator | No current product gives creators a personal AI manager via messaging |
| Creator dashboard | No off-the-shelf tool handles live-checked consent + kill switch model |
| Template engine + variation layer | Shared structure + per-creator surface variation |
| Payments + credit economy logic | Business rules (credits, subscriptions, quotas, per-modality pricing) |
| Social comment/DM assist pipeline | Draft-then-approve flow on creator's own social accounts |
| 17 Live payout integration | Custom integration |

### What We Buy (External, After GMI First Check)

| Layer | Decision |
|---|---|
| LLM | GMI first → GPT-4o + Claude Sonnet multi-provider fallback |
| RAG / Vector DB | Supabase pgvector (v1) → Pinecone at scale |
| Voice cloning | GMI first → ElevenLabs → Coqui open-source |
| Talking video | GMI first → HeyGen (agency tier) |
| Full-body motion | GMI first → Kling via fal.ai/PiAPI |
| Moderation | GMI first → Azure Content Safety (JP/ZH) |
| Shareable asset generation | Bannerbear or Placid |
| Payments | Stripe + LINE Pay (Adyen for JP local rails) |
| Auth | Clerk (LINE social login for JP market) |
| Hermes messaging channels | Telegram Bot API, LINE Official Account API, WhatsApp Business API |
| Product analytics | PostHog / Mixpanel + Segment |
| Error tracking | Sentry |
| LLM observability | Helicone |

---

## 16. Technical Constraints

- All AI generation is async. Never block a user request.
- Moderation is synchronous and pre-delivery.
- Consent checked live at generation time.
- Multi-tenancy per creator — persona, content, consent, billing fully isolated.
- Webview compatibility — payment and auth degrade gracefully in IG/TikTok webviews.
- Provider-agnostic adapters — all providers swappable without rewriting orchestration.
- Template variation is a system requirement, not a design preference.
- Hermes has no autonomous capability to post to external social accounts.
- OAuth scopes for social assist are minimally scoped — read + draft only; send requires creator action.
- <200ms p95 for text responses in JP/TW region.
- **Consent revocation:** consent revocation must cancel in-flight generation jobs and suppress queued delivery within 60 seconds of revocation event. Job queue must support cancellation of pending and in-progress jobs by `creator_id` and `consent_grant_id`.
- **Async generation SLAs:** voice generation: queue-to-delivery <30s p95. Video generation: queue-to-delivery <5 min p95. Both are fully async; user-facing request returns immediately on job enqueue. These SLAs drive provider selection — evaluate GMI voice/video capabilities against these targets first.
- **Moderation timing:** synchronous moderation must complete within 500ms p95. Combined text generation + moderation pipeline must remain <200ms p95 as measured from job-complete to delivery. Moderation that exceeds 1000ms p99 is a system fault.
- **Job reliability:** failed generation jobs: retry up to 3 times with exponential backoff before moving to dead letter queue. Creator dashboard must surface persistent failures. Fan-facing delivery must never silently drop — either deliver or notify that the message could not be generated. DLQ alerts to creator dashboard within 2 minutes of failure.
- **Data layer capabilities:** Postgres-compatible, row-level security enforced at the database layer for multi-tenant isolation. Job queue: Redis-backed, supports job cancellation by arbitrary key, dead letter queue, priority lanes. Specific product choices (Supabase, BullMQ, etc.) are ADR decisions, not PRD constraints.
- **Data portability & deletion:** creator persona data must be exportable in machine-readable format (JSON) within 72 hours of authenticated request. Fan data subject access requests (DSAR) must be serviceable within 30 days. Data deletion must be complete and verifiable within 72 hours of authenticated creator or fan request.

---

## 17. Localization Requirements

| Market | Language | Currency | Payment Methods | Hermes Channel |
|---|---|---|---|---|
| Japan | JP | JPY | Stripe, LINE Pay, JCB, convenience store (via Stripe JP or Komoju; payment instruction issued to fan, settlement confirmed within 3 business days; UI must handle pending state — subscription does not activate until confirmed) | LINE (primary), Telegram |
| Taiwan | ZH-TW | TWD | Stripe, LINE Pay, GASH, MyCard | LINE (primary), Telegram |
| SEA | EN + local TBD | TBD | TBD per market | Telegram (primary), WhatsApp |
| Global / EN | EN | USD | Stripe | Telegram, WhatsApp |
| Hong Kong | ZH-TW / EN | HKD | TBD (FPS, Octopus pending vetting) | LINE, Telegram |

> **HK status:** Planned post-launch (Day-2) market. Counsel review covers cross-border compliance and launch readiness. No HK-specific engineering begins until the HK launch milestone is approved. ZH-TW localization from Taiwan market applies.

> **SEA launch gate:** SEA market launch is contingent on defining: (1) target market(s) within SEA, (2) language requirements per market, and (3) payment rail integrations per market. No engineering work for SEA market-specific features should begin until these are confirmed by CEO.

> **CJK rendering:** CJK rendering (JP, ZH-TW) in LINE in-app browser and IG/TikTok webviews must be explicitly tested per language before each market launch. Character encoding (UTF-8), font fallbacks, and text wrapping in narrow viewports are minimum test cases.

---

## 18. Team & Agent Composition

**Phase 1: One Coder (full-stack AI + messaging integrations).**

Profile: TypeScript, Next.js, Supabase, LLM + RAG integration, Stripe, async job queues, Telegram Bot API, JP/ZH localization. The PRD is the architectural spec; the Coder executes it.

**Phase 2:** QA agent after Slice 1 MVP. Tests webview compatibility, payment flows, Hermes messaging flows across channels.

**CTO:** hire when multiple Coders and cross-cutting decisions bottleneck. Not now.

---

## 19. Success Metrics

### Launch Gates
- [ ] Legal sign-off on fan PII / personality rights in JP/TW/EN
- [ ] Revenue split signed with 17 Live
- [ ] GMI inference portfolio assessment complete — provider slots filled
- [ ] Voice + talking video quality validated (GMI or external) for JP/ZH/EN
- [ ] Payment flow tested in IG/TikTok webview
- [ ] Hermes functional on Telegram: content approval, kill switch, config change via conversation
- [ ] Kill switch tested: disables all interactions within 5 seconds
- [ ] Consent revocation tested: revoking a grant pulls existing generated content within 60 seconds

### 30-day
- First-paid → second-paid conversion: **>30%**
- Creator content-share rate: **>50% of generated shareables posted within 7 days**
- Creator Hermes engagement: **>70% of creators managing via Hermes rather than web dashboard**
- Fan page load time: **<2s on 4G JP/TW**
- Creator onboarding completion: **>70%**

### 90-day
- GMV per creator/month: TBD baseline from 17 Live data
- Creators using kill switch: **<5%**
- Voice note adoption (opted-in creators): **>30% of interactions**
- Talking video adoption (opted-in creators): **>15% of interactions**

---

## 20. What We Are Not Building in v1

- No autonomous posting to creator's social accounts. **Ever.**
- No native iOS or Android app. PWA only.
- No platform-level explicit content infrastructure. Creator controls her twin's tone; we don't police it.
- No in-app integration into 17 Live app.
- No self-hosted foundation model or voice model.
- No AI-generated content without the corresponding explicit consent grant.
- No influencer-brand CRM (wrong tool for managing fans).
- No autonomous social comment/DM replies — drafted by AI, sent by creator.
- No creator-managed Telegram bot tokens — 7of1 manages all bot infrastructure.
- No dark-pattern free trial auto-converts — fans choose to subscribe; no bait-and-switch billing.
- No direct-card-per-PPV — credits wallet only; all premium interactions use pre-purchased credits, no per-interaction 3DS friction.

---

---

## 22. Technical Build Guide — Dev Environment & Implementation

### 22.1 Infrastructure

**Start on Replit.** Build the prototype and first demo there — zero setup, fast to a working fan page + text twin.

**Production: GCP or AWS** (decision follows whichever cloud GMI already operates on). Replit is not suitable for production JP/TW latency, async AI workers, or high-concurrency fan pages. Migration is clean if the codebase is Replit-agnostic from day one (no Replit-specific APIs). Move to GCP/AWS before the first real creator goes live.

GCP default recommendation: Cloud Run (Tokyo + Taiwan regions) for fan pages, Cloud Tasks + Pub/Sub for async queues, GCS for asset storage, Vertex AI for GMI-first inference.

**GCP stack (recommended):**

```
┌──────────────────────────────────────────────────────────┐
│  FRONTEND (Fan page + Creator dashboard)                 │
│  Next.js 14+ containerized → Cloud Run                   │
│  Regions: asia-northeast1 (Tokyo) + asia-east1 (Taiwan)  │
│  Cloud CDN for static assets                             │
├──────────────────────────────────────────────────────────┤
│  BACKEND API                                             │
│  Cloud Run (containerized Next.js API routes)            │
│  Cloud Run Jobs for one-off tasks                        │
├──────────────────────────────────────────────────────────┤
│  DATABASE                                                │
│  Cloud SQL (PostgreSQL) + pgvector extension             │
│  OR Supabase (managed, retains pgvector + Realtime)      │
│  Cloud Firestore or Supabase Realtime for live chat      │
├──────────────────────────────────────────────────────────┤
│  ASYNC JOB QUEUE                                         │
│  Cloud Tasks (HTTP-based, per-task targeting)            │
│  Cloud Pub/Sub (fan-out notifications, event streaming)  │
│  Workers: Cloud Run services (scale to zero between jobs)│
├──────────────────────────────────────────────────────────┤
│  FILE STORAGE                                            │
│  GCS (creator asset uploads — photos, videos)            │
│  Signed upload URLs for direct browser → GCS upload     │
├──────────────────────────────────────────────────────────┤
│  HERMES BOT SERVICE                                       │
│  Single Cloud Run service: one @7of1 Telegram bot        │
│  LINE Messaging SDK (JP), WhatsApp Cloud API (SEA)       │
│  Webhook-based (not polling)                             │
└──────────────────────────────────────────────────────────┘
```

**AWS is equally valid** if GMI has existing AWS infrastructure or preference:
- Fan pages: ECS Fargate + CloudFront (ap-northeast-1 Tokyo, ap-northeast-3 Taiwan)
- Database: Aurora PostgreSQL + pgvector
- Queues: SQS + Lambda workers
- Storage: S3
- Realtime: API Gateway WebSocket or AppSync

**Decision to make:** does GMI already run on GCP or AWS? Use whichever cloud the team already has accounts, tooling, and infra comfort with. The application code is cloud-agnostic — containers + standard PostgreSQL + webhook-based messaging.

---

### 22.2 Hermes: One Official @7of1 Bot (Not Per-Creator Bots)

**The correct architecture is a single official bot, not thousands of per-creator bots.**

One `@7of1_bot` (or `@hermes_7of1_bot`) handles all creators. The bot is multi-tenant by creator context — every creator talks to the same bot, and the bot knows who they are from their Telegram user ID linked to their 7of1 account.

```
Creator messages @7of1_bot
   → Webhook fires to single Hermes Cloud Run service
   → Look up Telegram user_id in creator table
   → If not linked: send OAuth deep-link to connect account
   → If linked creator: load creator context → respond as Hermes
   → All conversation state namespaced per creator_id in DB
```

**Benefits of single-bot architecture:**
- One bot token to manage, one service to scale, one webhook endpoint
- Creator onboarding is one step: "Start @7of1 on Telegram, type /connect"
- No Telegram API limits from running thousands of bots
- All creators get improvements instantly when the bot is updated
- Can eventually build a Telegram Mini App (TWA) within the same bot for richer UI

**Creator registration flow:**
1. Creator opens @7of1_bot on Telegram
2. Bot: "Welcome to 7of1 Hermes. Connect your creator account to get started." + deep link
3. Creator taps link → authenticates on 7of1 web → account linked
4. From now on: any message to @7of1_bot is routed to their personal Hermes context

**The same bot for LINE (JP) and WhatsApp (SEA):** same architecture — one LINE Official Account for 7of1, one WhatsApp Business number. All multi-tenant per creator_id.

---

### 22.3 Hermes Bot: Creator Context vs. Fan/Twin Context

The user raised an interesting angle: could fans also interact with a creator's digital twin through @7of1_bot?

**Architecture options:**

| Option | How it works | When to build |
|---|---|---|
| **A: Web-only twin, Telegram-only Hermes** | Fan page (web) = fan↔twin. @7of1_bot = creator management only. Clean separation. | v1 — simplest |
| **B: @7of1_bot routes by user role** | Fan messages @7of1_bot → "Which creator do you want to talk to?" → routes to that creator's twin context. Same bot, different conversation mode. | P1 — after web twin is validated |
| **C: Telegram Mini App (TWA) in @7of1_bot** | Bot has an embedded web app inside Telegram for richer fan experience (payments, media). Fan taps a button in chat → opens the fan page as a TWA. | P1 |
| **D: Creator-hosted Telegram channel with twin** | Creator's twin is active as a bot in a Telegram channel she owns. Her fans interact there. | P2 — requires separate privacy/consent analysis |

**Recommendation for v1:** Option A. The fan experience is the web fan page — that is where we control the full UX, payment flow, and webview optimization. Telegram is the creator management interface. Keep the separation clean until the web loop is validated.

**Recommendation for P1:** Option B. Once the core loop works, routing fans to creator twins via @7of1_bot is a natural expansion — the twin engine already exists, it just needs a Telegram conversation interface wrapping it.

---

### 22.4 Updated Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Web framework | Next.js 14 (App Router) | Containerized for Cloud Run |
| Hosting | GCP Cloud Run (Tokyo + Taiwan regions) | Cloud CDN for static assets |
| Database | Cloud SQL PostgreSQL + pgvector | OR Supabase managed (retains Realtime) |
| Auth | Supabase Auth or Firebase Auth | Magic link + phone OTP; LINE social login for JP |
| Realtime (fan chat) | Supabase Realtime or Firebase Realtime | Async delivery of voice/video results |
| Job queue | GCP Cloud Tasks + Cloud Pub/Sub | Async voice/video generation; no Redis needed |
| File storage | GCS + signed upload URLs | Creator asset uploads |
| Hermes | Single Cloud Run service + Telegraf | One @7of1_bot, all creators, webhook-based |
| LINE (JP Hermes) | LINE Messaging API | LINE Official Account for 7of1 |
| WhatsApp (SEA) | WhatsApp Cloud API | Single WhatsApp Business number |
| LLM orchestration | GMI first; LiteLLM wrapper for fallback | Provider-agnostic |
| Voice | GMI first; ElevenLabs SDK fallback | |
| Video | GMI first; HeyGen API + Kling/fal.ai fallback | |
| Moderation | GMI first; Azure Content Safety fallback | |
| Asset generation | Bannerbear or Placid | Shareable cards |
| Payments | Stripe Embedded + LINE Pay | Webview-safe |
| Error tracking | Sentry | |
| LLM observability | Helicone | Cost tracking per creator |
| Analytics | PostHog or Google Analytics 4 | |

---

### 22.5 The Five Hard Technical Problems

*(Unchanged from prior version — cloud provider doesn't affect these)*

1. **Webview compatibility** — IG/TikTok kill OAuth popups and payment redirects. Magic link auth + Stripe Embedded from day one. Test on real devices.
2. **Async generation pipeline** — voice/video take 5–120s. Immediate text reply → Cloud Tasks job → worker → provider → Pub/Sub → Realtime → audio/video in fan's chat.
3. **Per-creator RAG multi-tenancy** — per-creator vector index + persona + live consent check on every message. Hot path, needs caching.
4. **Hermes state management** — stateful conversation per creator in DB; Cloud Tasks delayed jobs for timed nudges; kill switch = direct DB write.
5. **Consent live-check performance** — 30s in-memory cache per active creator session; DB write-through on revocation.

---

### 22.6 Development Sequence

**Prototype phase (can use Replit or local):**
- Week 1–2: Next.js + Cloud SQL (or Supabase) + text twin + fan page. Test in IG webview on real device.
- Week 3–4: Stripe Embedded paywall + credits + basic dashboard.

**Production migration (move to GCP Cloud Run before real creators):**
- Week 5–6: @7of1_bot on Telegram (single bot) + Hermes management interface + full per-creator config + shareable content engine.
- Week 7–8: Template engine + social calendar + Cloud Tasks job queue for async workers.
- Week 9–10: Voice + video workers + additional payment rails.




---

## 23. Data Ownership & Model Portability (The Real Moat)

### 23.1 What 7of1 Owns

The base LLMs (GPT-4o, Claude, Gemini, or a future GMI model) are commodity infrastructure — we rent compute time. The competitive advantage is the **per-creator data layer** that 7of1 builds and controls:

| Asset | What it is | 7of1 owns? | Portable across LLMs? |
|---|---|---|---|
| **Conversation history** | Every fan↔twin exchange, tagged by creator | Yes | Yes — format-agnostic text |
| **Creator content corpus** | Uploaded captions, transcripts, text persona data | Yes | Yes — raw text |
| **RAG index** | Per-creator vector embeddings of content corpus | Yes (index + source data) | Partially — re-embed on new model if embedding provider changes. Estimated re-embedding cost = [vector count × embedding API price] per creator; factor into provider tier selection. |
| **LoRA adapters (image/video)** | Fine-tuned low-rank weights on creator photos/videos for visual identity | Yes | Base-model-specific — retrain on new base, but training data remains |
| **Video training data** | Creator photos, talking videos, motion reference clips | Yes | Yes — raw assets |
| **Persona system prompt** | Structured creator persona (tone, limits, phrasing) | Yes | Yes — model-agnostic |
| **Consent records** | Signed grants per creator per modality | Yes | N/A |

### 23.2 What This Means for LLM Switching

Because 7of1 owns the **data** and the **persona layer** (RAG corpus + conversation history + system prompt), switching base LLMs requires no retraining of the creator persona:

```
Current: [Creator RAG + Persona Prompt + History] → GPT-4o → fan response
Switch:  [Creator RAG + Persona Prompt + History] → Claude 4 → fan response
                    ↑ same data, same prompt, different API endpoint
```

The provider adapter in the architecture (§11) is the only thing that changes. The creator's "voice" — her knowledge base, her phrasing, her conversational history — is preserved in the data layer 7of1 controls.

**What CAN'T be swapped without retraining:**
- **LoRA adapters for image/video generation** — these are trained against a specific base model (e.g., a Stable Diffusion checkpoint or a HeyGen model). If the base model changes, the LoRA weights need to be retrained. However, the **training data** (the creator's photos and videos) is owned by 7of1, so retraining is possible at any time.
- **Voice clones** — cloned voice models are provider-specific (ElevenLabs model ≠ GMI voice model). The original audio/video source material is owned by 7of1, so re-cloning on a new provider uses the same source. Voice provider migration is a **planned migration, not a config swap**. At 1,000+ creators, re-cloning from source audio is a multi-week operation. Prefer voice providers with strong multi-year stability, and maintain a source audio archive that can support re-cloning without creator re-engagement.

### 23.3 Strategic Implication

This is the data flywheel that compounds over time:

```
Creator onboards → uploads content + consents
   → 7of1 builds: RAG index + LoRA adapters + voice clone
   → Fans interact → conversation history accumulates
   → Twin gets more accurate to creator over time
   → Switching to 7of1 from a competitor: start from zero
   → Staying on 7of1: compounding data advantage
```

The more creators use 7of1 and the more fan interactions accumulate, the more accurate and valuable each creator's twin becomes — and the harder it is to replicate elsewhere. This is the moat, not the LLM.

### 23.4 Training Infrastructure Requirements

Running LoRA fine-tuning per creator (for image/video models) requires GPU compute. Options:

| Option | Notes |
|---|---|
| **On-demand training via provider API** (HeyGen, ElevenLabs) | Easiest v1 path — provider handles training, 7of1 triggers via API. We own the source assets; they run the compute. |
| **GMI inference GPU fleet** | If GMI has GPU infrastructure, run LoRA training in-house. Higher control, lower unit cost at scale. |
| **Cloud GPU (GCP Vertex AI Training, AWS SageMaker)** | Managed training jobs. Pay per training run. Good middle path. |
| **RunPod / Modal** | Cheap spot GPU compute for training jobs. Good for cost-optimized early scale. |

**v1 recommendation:** let providers (HeyGen, ElevenLabs) handle the LoRA training via their APIs — 7of1 supplies the source assets and triggers training. Move training in-house (via GMI or cloud GPU) when per-creator training volume justifies the infrastructure investment.

**Trigger for in-house LoRA migration:** monthly training volume > 500 creator jobs/month OR per-creator training cost > $15/creator/month via provider API.

### 23.5 Data Schema Principles

Every per-creator data asset must be:
- **Identified** by creator_id (enables full data export and deletion)
- **Versioned** (track when the RAG index was last rebuilt, when voice was last re-cloned)
- **Deletable** (creator data deletion request wipes all derived assets — consent record marks deletion but is retained for legal purposes)
- **Exportable** (creator can take their data if they leave 7of1)

This is both a legal requirement (APPI / PDPA) and a trust requirement. A creator who knows she can leave and take her data is more willing to give it.

**Consent revocation SLA:** when a creator revokes a consent grant, all content produced under that grant must be removed from active delivery (fan page, social queue, approval queue) within **60 seconds** of revocation. The consent record marks the revocation timestamp and is retained for legal audit; derived assets are purged. The data schema must support fast enumeration of all assets produced under a specific `consent_grant_id`.

Every generated asset (voice note, video, image, text response) stores: `creator_id`, `consent_grant_version`, `created_at`, `usage_scope`. This enables: (a) fast purge of assets produced under a revoked grant, (b) audit of what was produced under each consent version, (c) partial revocation (revoke one modality without affecting others).


---

*Document owner: CEO / GMI Inference*
*Status: Draft v5 — English added, Hermes agent defined, social assist scoped, GMI-first provider policy*
*Last updated: 2026-05-23*

