# lala.la Product Roadmap

This roadmap captures the planned initiatives that close the gap between the
current product (a safety-first chat + voice twin engine, live for Claire) and
the full vision: a managed AI digital-twin service that gives influencers a
one-stop shop for chat, voice, image, and video generation — deployable on
lala.la, Telegram, and (manually) their own social channels — backed by a
managed concierge.

> This is the **canonical product roadmap** for lala.la. The GSD engineering tracker —
> per-phase plans, success criteria, and requirement traceability — lives in
> [`../.planning/ROADMAP.md`](../.planning/ROADMAP.md) and records delivery against the
> initiatives below.

## Current state (already shipped)

- **Chat generation** — DeepSeek-V3.2 via GMI, sync (web) + async (Telegram worker), with conversation history, RAG, and 6-layer moderation.
- **Voice generation** — GMI TTS with voice cloning, worker pipeline, web playback + Telegram voice notes.
- **Telegram deployment** — Hermes (creator management bot) + Fan-Twin (per-creator fan bot).
- **lala.la/[handle] web chat** — fan-facing twin chat with trial limits, monetization nudges, safety/compliance.
- **Compliance scaffolding** — KYC, crisis detection, AI disclosure, DSAR, kill-switch, eval gate.

## Dependency ordering

```
Marketing site     (independent)
Lala Concierge     (independent)
Image generation  ─┐
                   ├─→ Content studio + social export
Video generation  ─┘
```

Content studio depends on both Image generation and Video generation, since it
assembles and exports the media those engines produce. The other three
initiatives are independent and can proceed in parallel.

---

## 1. Lala.la marketing site

**What & why** — The public landing page is currently an 8-line placeholder.
Build a real marketing front door that introduces lala.la as a managed AI
digital-twin service: one place to run a twin (chat, voice, image, video) on
lala.la and on a creator's own social channels, with managed white-glove setup.

**Done looks like**
- The locale root shows a polished, multi-section marketing site (not a placeholder).
- It communicates the value proposition, the four generative capabilities, the multi-channel deployment story, and how managed onboarding works.
- A primary CTA routes creators into the existing onboarding/contact flow.
- Responsive, mobile-first, localized for en/ja/zh-TW.
- The fan route `lala.la/[handle]` is unaffected.

**Out of scope** — pricing/billing/self-serve signup, backend/API changes, blog/docs/help-center content.

## 2. Lala Concierge

**What & why** — Deliver the promised "concierge" that helps creators when
something isn't working. Reuse the existing chat engine (DeepSeek-V3.2 via GMI)
to answer questions, explain account/twin status, and triage problems.

**Done looks like**
- Creators get accurate, helpful answers to free-form questions.
- Reachable from both the Hermes Telegram bot and the web creator dashboard.
- Tailors answers to the asking creator's own status (KYC, twin active/paused, pending approvals).
- Cleanly escalates to the existing founder/support path when it can't resolve an issue.
- Grounded in a maintained help knowledge base, not hallucinated.

**Out of scope** — fan-facing help bot, taking destructive actions on a creator's behalf, a full ticketing system.

## 3. Image generation + LoRA management

**What & why** — "Image" is one of the four generative pillars and the twin's
visual likeness depends on it. Onboarding already collects 5–25 photos and the
consent text references LoRA training, but there is no image provider, training
job, or LoRA management surface. Build the visual identity engine.

**Done looks like**
- Uploaded approved photos trigger a LoRA training job with visible status (training / ready / failed).
- Creators can generate still likeness images from a text prompt and see them in the dashboard.
- Creators can list, retrain, and delete their LoRA model(s).
- Generated images pass the existing asset-moderation gate before being shown.
- Image jobs run async through the existing worker/queue architecture.

**Out of scope** — video generation, export for social posting, interactive image editing.

## 4. Video generation

**What & why** — "Video" is the fourth generative pillar. Provider interfaces
(`talking_video`, `fullbody_video`), a provider shell, and a worker already
exist but are stubs. Wire up working video generation.

**Done looks like**
- Creators can request a talking video of their twin and receive a finished asset.
- Video jobs run async with visible status (queued / processing / ready / failed).
- Finished videos pass the existing asset-moderation gate and appear in the dashboard.
- The provider is real (HeyGen or GMI video), replacing the current stubs.

**Out of scope** — image generation/LoRA training, export for social posting, timeline/clip editing.

## 5. Content studio + social export

**What & why** — Position lala.la as a one-stop shop to manage a twin "whether
on lala or their own socials." Social deployment is intentionally **manual**:
rather than integrating IG/Facebook APIs, give creators a studio where they
generate media from their twin and download it, ready to post themselves.

**Depends on** — Image generation (#3) and Video generation (#4).

**Done looks like**
- A single studio surface in the dashboard brings image, video, and voice generation together with a shared gallery.
- Every generated, approved asset can be downloaded in a social-ready format.
- Each asset offers copy-ready caption + AI-disclosure text to paste when posting.
- The studio surfaces moderation/approval status so only approved content is exportable.
- Framed as "generate here → download → post on your own IG/Facebook/etc." with no platform API connection required.

**Out of scope** — automated posting/scheduling via platform APIs, the underlying generation engines themselves, external-platform performance analytics.
