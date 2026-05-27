# Feature Landscape: AI Creator Digital-Twin / Fan Companion Platform

**Domain:** B2B AI companion service — creator pays, fans interact
**Product:** lala.la — managed AI digital-twin for live influencers (JP/TW/HK)
**Researched:** 2026-05-27
**Overall confidence:** HIGH (compliance features), HIGH (fan UX patterns), MEDIUM (B2B creator dashboard norms)

---

## Context: Two Distinct User Groups

lala.la has two user populations with different feature expectations.

**Creator (B2B customer, paying):** Wants her brand extended 24/7 without spending her own time. Fears looking fake, losing fan trust, or losing control of her likeness. Success = fans stay engaged with her real platforms.

**Fan (end user, free):** Wants to feel like they matter to the creator. Expects the experience to feel like "her" — voice, cadence, emoji habits, in-jokes. Success = a real-feeling interaction that leads them to support her monetization channels.

These populations have almost no feature overlap. Almost every feature serves one or the other, not both.

---

## Table Stakes

Features where absence causes creators to reject the product or fans to churn immediately.

### Creator Side

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| No-code onboarding via familiar channel | Creators are not developers; they expect Telegram DMs or a simple web form, not API keys | Low | PROJECT.md mandates Lala Telegram bot intake flow |
| Persona consent capture + digital signature | Personality-rights law requires documented consent before deployment; creator expects paper trail | Medium | KYC gate: `creator_kyc.status = 'signed'` blocks twin until complete |
| Voice sample intake | Voice is table stakes for Asian live-streaming market; fans expect to hear "her" | Medium | 30-second sample clip minimum; GMI Cloud XTTS zero-shot |
| Character card review before go-live | Creator must approve the persona before fans see it; no surprises | Low | Preview flow + approval gate, then 30-case eval suite |
| Twin goes dark if creator cancels | Creator owns her IP; lala.la must not run a twin without active consent | Low | Entitlement middleware: 423 on all twin routes if KYC lapses |
| Creator owns her data | Non-exclusive license; export/delete on request | Medium | GDPR/APPI/PDPA data-minimization baseline; deletion procedure |
| Clear AI disclosure on every surface | SB 243 mandatory; creator is legally exposed if absent | Low | Banner/header on lala.la/[handle] and Telegram bot bio |

### Fan Side

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Responds in creator's voice + style | Core premise; if the tone is wrong fans notice in the first message | High | Character Card V2 fields: description, personality, mes_example, first_mes |
| Responds in fan's language | JP/TW/HK fans code-switch; responding in the wrong language kills immersion | Medium | EN + JP + ZH-TW i18n first-class from day 1; detect input language, reply in kind |
| Voice replies available | Live-streaming fans are accustomed to voice; text-only feels like a downgrade | High | GMI Cloud XTTS per-message audio; async acceptable, <3s target |
| Conversation feels continuous | Fans reference earlier exchanges; if the twin "forgets" everything each session it feels robotic | Medium | Plain context window for v1 (locked decision); HMAC-signed conversation_id per session |
| Will not produce harmful content | Fans with mental health struggles exist in every fanbase; harmful output is a crisis + legal event | High | Six-layer moderation pipeline; self-harm detection + crisis helpline injection |
| Clear "this is AI" notice | SB 243 mandatory; fans who feel deceived become hostile | Low | Conspicuous, non-dismissable banner; not buried in ToS |
| Fast enough to feel conversational | >5s latency breaks immersion; fans abandon | Medium | GMI Cloud LLM + XTTS pipeline; streaming text in Phase 5+ |

---

## Differentiators

Features that give lala.la a competitive edge specifically in the JP/TW/HK creator market and B2B managed-service positioning.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Managed service (founder operates the AI) | Creators do not want to learn prompt engineering; lala.la handles the ops | Low (ops) | Differentiates from self-serve tools like FanWake or Fanvue AI |
| Telegram-native fan experience | Asian creators and fans already live in Telegram; no app download friction | Medium | Fan-twin Telegram bot; lala.la/[handle] web fallback |
| Creator-branded funnel page (lala.la/[handle]) | Creator gets a shareable link pointing to her AI twin; works as a landing page for any traffic source | Low | Web surface with soft CTA to creator's real monetization platforms |
| Soft CTA to creator's existing monetization stack | Nudges fans toward Fanvue/Patreon/17 LIVE without a competing payment wall | Low | CTA templates in persona constitution; context-aware trigger logic |
| 30-case eval suite before go-live | Guarantees persona quality and hard-limit compliance before creator sees her twin; removes launch anxiety | Medium | 10 in-character + 10 boundary + 10 hard-limit; 100% hard-limit pass required |
| Character Card V2 portability | Creator can take her persona to another platform; non-lock-in is a trust signal for sophisticated creators | Low | Industry-standard format; JSON export on request |
| Multi-locale compliance baseline baked in | JP/TW/HK creators face APPI (Japan), PDPA (Taiwan/HK), plus SB 243 and TRAIGA exposure for US fans | High | Not a differentiator if absent; becomes one because competitors skip it |
| Fan-name masking in audit logs | Protects fan privacy; creator cannot accidentally see a fan's real-world identity in logs | Medium | OCR intake + review queue for masking; PROJECT.md specifies founder-operated v1 |
| Public + private twin schema | Creator can have a PG public twin and a private twin with different boundaries | Low (schema) / High (security) | Schema column ships in Phase 1; access-control security deferred to Phase 3+ |

---

## Anti-Features

Things to deliberately NOT build — each carries either a locked decision reason or a strategic reason.

| Anti-Feature | Why Avoid | What to Do Instead | Decision Status |
|--------------|-----------|-------------------|-----------------|
| Fan payment loop / fan accounts / Stripe Connect | Adds compliance burden, changes product category from "AI plumbing" to "payment processor"; creates chargeback and dunning liability | Nudge fans to creator's own monetization platforms | Locked — PROJECT.md |
| Persistent long-term memory (Letta / Graphiti / Neo4j) | Adds significant ops and cost complexity at N=1; overkill until creator #3-5 | Plain context window per session (HMAC conversation_id) | Deferred — PROJECT.md |
| AI image generation | TAKE IT DOWN Act compliance gates this; non-consensual synthetic imagery is a legal crisis waiting to happen | Phase 5+ with Illustrious XL + LoRA when compliance pathway is clear | Deferred — PROJECT.md |
| SSE/streaming text responses | Nice-to-have polish; engineering cost exceeds value at N=1 | Async text reply is acceptable; voice reply covers "feels alive" | Deferred to Phase 5+ |
| LINE / WhatsApp channels | More surface area, more ops, more edge cases | Telegram + web first; expand after product-market fit | Deferred to Phase 6 |
| Bespoke LLM engine / fine-tuned model | Commodity providers are faster to ship, cheaper to run, and easier to swap; fine-tuning at N=1 is vanity | Character Card V2 + strong system prompt + moderation pipeline | Locked — PROJECT.md |
| Romantic / intimate relationship framing | Replika was forced to remove it under regulatory pressure (EU, FTC complaint); creates disproportionate safety and legal risk | Parasocial friendship framing; warmth without romantic promises | Strategic |
| Fan social features (fan-to-fan chat, community) | Scope creep; lala.la is not a social platform | Creator directs engaged fans to her existing community (Discord, etc.) | Strategic |
| Admin automation agents (5 background AI workers) | Founder is the agents at N=1; automation budget unavailable | Founder operates manually | Deferred |

---

## Feature Dependencies

```
Creator KYC / consent capture
  → Entitlement middleware (423 gate)
    → Twin chat routes (web + Telegram)
      → AI disclosure banner (required on every surface)
      → Six-layer moderation pipeline
        → Self-harm detection + crisis helpline injection
        → Audit log (with fan-name masking)

Character Card V2 persona (description, personality, mes_example, voice sample)
  → 30-case eval suite (10 in-character + 10 boundary + 10 hard-limit)
    → Go-live approval (creator signs off, eval 100% pass)
      → Voice replies (GMI Cloud XTTS — needs voice sample from persona intake)

HMAC-signed conversation_id
  → Session continuity (plain context window)
  → Rate-limiting / abuse protection

Soft CTA templates (in persona constitution)
  → Context-aware nudge logic
    → Telegram bot surfaces
    → lala.la/[handle] web funnel page

i18n (EN + JP + ZH-TW)
  → Fan-facing chat UI
  → Crisis helpline injection (locale-specific hotlines differ)
  → AI disclosure text
```

---

## MVP Feature Set (Week 4 Launch Target)

The following is the minimum set that makes a real creator go live and a real fan have a meaningful interaction.

**Must ship (creator-blocking if absent):**
1. Creator KYC onboarding via Lala Telegram bot — consent, persona, voice sample, character card
2. AI disclosure banner (SB 243 compliance — legally required)
3. Self-harm detection + crisis helpline injection (SB 243 compliance — legally required)
4. Six-layer moderation pipeline with audit log
5. 30-case eval suite — 100% hard-limit pass before go-live
6. Entitlement middleware — 423 until KYC signed

**Must ship (fan experience):**
1. AI twin chat on lala.la/[handle] web funnel page
2. AI twin chat via Telegram fan-twin bot
3. Voice reply via GMI Cloud XTTS
4. i18n: EN + JP + ZH-TW first-class
5. Soft CTA to creator's monetization platforms
6. HMAC-signed conversation_id per session

**Defer (documented above as out of scope):**
- Persistent memory / Letta / Graphiti
- AI image generation
- Fan payment loop
- SSE streaming text
- LINE / WhatsApp

---

## Compliance Feature Map

SB 243 (California, effective 2026-01-01) and TRAIGA (Texas, effective 2026-01-01) create hard legal requirements that are not optional features. They are gate conditions.

| Compliance Requirement | Source Law | Required Feature | Severity |
|------------------------|------------|-----------------|----------|
| AI disclosure at interaction start | SB 243 §1 | Conspicuous banner on all chat surfaces | BLOCKER — private right of action, $1,000/violation |
| No content promoting suicidal ideation | SB 243 §2 | Self-harm classifier (Replika-style L1-L5 pipeline) | BLOCKER |
| Crisis service referral when user expresses self-harm | SB 243 §2 | Locale-aware crisis helpline injection | BLOCKER |
| Minor-specific break reminders every 3 hours | SB 243 §3 | Age detection OR blanket application; 3-hour timer | HIGH — applies if any minor users plausible |
| Suitability warning re: minors | SB 243 §1 | In-app notice that service "may not be suitable for some minors" | HIGH |
| Publish safety protocols on website | SB 243 §4 | Safety policy page at lala.la/safety | MEDIUM |
| Annual crisis interaction reporting (from 2027-07-01) | SB 243 §5 | Audit log with crisis event counts | LOW now, HIGH by 2027 |
| AI disclosure before or at interaction start | TRAIGA | Same banner covers this | MEDIUM — Texas user exposure only |
| GDPR / APPI / PDPA data minimization | GDPR Art. 5, APPI, PDPA | Fan-name masking, short log retention (30-90 days), no unnecessary PII in LLM prompts | HIGH |

---

## What Creators in the JP/TW/HK Market Specifically Expect

Based on the live-streaming creator market context (17 LIVE, NicoNico, TikTok Live):

- **Speed of setup**: JP/TW creators are accustomed to third-party tools that "just work" over Telegram or LINE. A no-code Telegram bot intake matches their existing workflow.
- **Voice is non-negotiable**: In live-streaming culture, voice messages carry emotional weight that text cannot replicate. Voice AI is a product requirement, not a nice-to-have.
- **Polite register awareness**: Japanese keigo (formal speech register) and Traditional Chinese politeness conventions must be handled correctly in character cards. A wrong register instantly signals "bot."
- **Creator owns the narrative**: Asian creator culture emphasizes strong personal brand control. The non-exclusive license and immediate twin shutdown on consent withdrawal are trust prerequisites.
- **No embarrassing outputs**: In tight-knit JP/TW creator communities, a single inappropriate twin output can go viral and destroy a creator's career. The 30-case eval suite and hard-limit moderation exist for this reason.

---

## What Fans Expect (Cross-Platform Research)

Based on Replika, Character.AI, and Fanvue AI usage patterns:

- **Personality consistency across sessions**: Fans notice when tone shifts. Character Card V2's `mes_example` field is critical for training consistent voice.
- **Remembers something**: Even shallow context continuity (within-session) matters enormously. The HMAC conversation_id + plain context window covers this adequately at N=1.
- **Responds to emotional investment**: Fans share personal things. The system must respond warmly without escalating into parasocial dependency territory. Soft deflection protocol for boundary cases.
- **Does not feel like a form**: Fans have strong radar for templated responses. The character card's `first_mes` and `scenario` fields must be crafted by a human who knows the creator.
- **The CTA feels natural**: Fans accept being pointed toward the creator's Patreon/Fanvue IF it comes after genuine engagement. Premature or robotic CTAs drive churn. Context-aware nudge logic (not every N messages) is required.
- **Language parity**: A ZH-TW fan who writes in Traditional Chinese expects a Traditional Chinese reply, not a Simplified Chinese reply or an English one. Language auto-detection + locale-appropriate response is expected.

---

## Sources

- Fanvue AI features: [Fanvue AI](https://www.fanvue.com/pages/fanvue-ai)
- FanWake creator chatbot patterns: [FanWake](https://fanwake.app/guide)
- California SB 243 compliance requirements: [Gunderson Dettmer analysis](https://www.gunder.com/en/news-insights/insights/client-insight-california-sb-243-new-compliance-requirements-for-operators-of-ai-companion-chatbots), [Jones Walker analysis](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/ai-regulatory-update-californias-sb-243-mandates-companion-ai-safety-and-accoun.html)
- TRAIGA (Texas): [Baker Botts analysis](https://www.bakerbotts.com/thought-leadership/publications/2025/july/texas-enacts-responsible-ai-governance-act-what-companies-need-to-know)
- Replika safety pipeline: [Replika Blog — Safe Experience](https://blog.replika.com/posts/creating-a-safe-replika-experience)
- Character.AI self-harm safety: [CNN Business](https://www.cnn.com/2025/04/03/tech/ai-chat-apps-safety-concerns-senators-character-ai-replika)
- Character Card V2 spec: [GitHub spec](https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md), [SillyTavern docs](https://docs.sillytavern.app/usage/core-concepts/characterdesign/)
- Persona jailbreak / multi-turn attack patterns: [Repello AI DAN analysis](https://repello.ai/blog/dan-jailbreak-personas-evil-confidant-antigpt)
- AI companion market data: [AI Companions Statistics 2025](https://electroiq.com/stats/ai-companions-statistics/), [Market Clarity](https://mktclarity.com/blogs/news/ai-companion-market)
- Creator digital twin IP / portability: [Herbert Smith Freehills — Khaby Lame deal](https://www.hsfkramer.com/notes/ip/2026-02/selling-your-ai-digital-twin-the-brave-new-world-of-identity-led-ip-transactions-the-khaby-lame-deal-analysed)
- GDPR data minimization for chatbots: [Quickchat AI GDPR guide](https://quickchat.ai/post/gdpr-compliant-chatbot-guide)
