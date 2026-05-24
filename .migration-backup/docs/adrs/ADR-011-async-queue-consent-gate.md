# ADR-011: Async Generation Queue, Consent Query Pattern, Tier Enforcement, and Webview Constraints

**Status:** Accepted  
**Date:** 2026-05-24  
**Author:** CTO (f31453ef)  
**Spawned from:** [OF-6](/OF/issues/OF-6) PRD §11 review  
**Lenses applied:** async-by-default, consent-as-system-requirement, webview-compatibility, provider-portability, cost-per-interaction

---

## Decision 1 — Async Job Queue

### Context

§11 implies synchronous assembly before provider dispatch. Voice, video, and image generation take 3–60 seconds per job. Blocking a user-facing HTTP request on any of these is architecturally unacceptable — it creates timeout risk, poor UX, and unscalable infrastructure.

### Decision

**Adopt BullMQ (Redis-backed) as the async job queue.** The async boundary sits between the Orchestration layer and Provider dispatch. The surface layer (Hermes/fan page) never awaits a generation result; it receives a job reference immediately and is notified upon completion.

### Queue Topology

```
Surface Layer (Hermes)
    │
    ▼
Orchestration Layer
    │  1. Check consent (live query)
    │  2. Check tier + rate limit
    │  3. Enqueue job → returns { job_id, status: "queued" }
    ▼
BullMQ Queue (Redis)
    │
    ▼
Worker Pool (stateless, horizontally scaled)
    │  - Reads job from queue
    │  - Calls Provider Adapter (voice / video / image)
    │  - Writes result to Job Store
    │  - Emits completion event → Hermes notification
    ▼
Hermes Notification Layer
    │
    ▼
Creator / Fan (Telegram, webhook, fan page push)
```

**Invariants that must hold:**
- No generation result is awaited synchronously in any user-facing request path
- The surface layer (Hermes) never calls provider adapters directly
- Every generation job returns a `job_id` within 200ms of the surface layer request
- Workers are stateless — they read jobs and call providers via the uniform provider adapter interface

### Immediate surface layer response payload

```json
{
  "job_id": "uuid",
  "status": "queued",
  "modality": "voice",
  "estimated_completion_ms": 8000,
  "notification_channel": "telegram" | "webhook" | "poll",
  "poll_url": "/api/jobs/{job_id}/status"
}
```

### Retry and Dead Letter Policy

| Attempt | Delay  | Trigger |
|---------|--------|---------|
| 1st retry | 5s | Provider error / timeout |
| 2nd retry | 30s | Provider error / timeout |
| 3rd retry | 2 min | Provider error / timeout |
| DLQ | — | After 3 failures |

On DLQ entry: fan/creator receives failure notification via Hermes with a manual retry option. DLQ is monitored; CTO-level alert fires on DLQ depth > 10 within 5 minutes.

**If queue is unavailable (Redis down):** Orchestration returns a structured error synchronously — generation request fails cleanly. Surface layer renders "Generation temporarily unavailable — please retry." No silent drops, no unbounded waits.

### Queue Technology Rationale

| Option | Chosen? | Rationale |
|--------|---------|-----------|
| **BullMQ (Redis)** | ✅ Yes | Works on Replit and GCP/AWS without provider lock-in. Redis doubles as rate-limit counter store (Gap 3). First-class job status, retry, DLQ, job delay, and per-queue concurrency. Single dependency for queue + rate-limit. |
| SQS | ❌ No | AWS lock-in violates provider-portability lens. No real-time job status without polling. Higher complexity for job result delivery. At 100k jobs/day: ~$1.20/month (similar to Redis), but adds AWS dependency. |
| GCP Pub/Sub | ❌ No | GCP lock-in. Push-based model is more complex for job-result fan-out. No built-in retry-with-delay. |
| In-process queue | ❌ No | No fault tolerance. Jobs lost on restart. Cannot scale horizontally. |

### Cost Per Interaction — Queue Infra

Redis (Cloud Memorystore Basic, 1GB): ~$50–80/month fixed.  
Amortized at 100k jobs/day: **~$0.00002 per job** — effectively zero against provider costs.  
Voice generation dominant cost: TTS provider (~$0.01–0.03/note).  
Video generation dominant cost: video provider (~$0.10–0.50/clip).  
Queue infra adds <0.01% to per-interaction cost at this scale.

### Rollback Path

If BullMQ/Redis is unavailable: orchestration returns error with `retry_after` header. No fallback to synchronous generation — that path is architecturally forbidden. Recovery: Redis restarts; jobs already in DLQ are replayed manually or via operator action.

---

## Decision 2 — Consent Layer as Cross-Cutting Pre-Dispatch Gate

### Context

The §11 PRD diagram places "Permission/Consent" as a layer below Orchestration+Template, which reads as a downstream pipeline step. This is architecturally incorrect. Consent is a live gate that orchestration must query before any job is dispatched.

### Decision

**Consent is a persistent gate queried live at the start of every generation request. It is not a pipeline step. Orchestration reads from the consent store directly; it never passes consent state to providers.**

### Consent Query Interface Contract

**Input:**
```json
{
  "creator_id": "uuid",
  "modality": "voice" | "video" | "image" | "text",
  "consent_grant_version": integer
}
```

**Output:**
```json
{
  "status": "granted" | "denied" | "revoked",
  "grant_id": "uuid",
  "revoked_at": "ISO8601 | null",
  "checked_at": "ISO8601"
}
```

**Invariants:**
- Consent is NEVER cached in the orchestration layer
- `consent_grant_version` must match the current live grant version; stale grant versions return `denied`
- Denied/revoked consent returns a structured error to the surface layer within 100ms
- Orchestration cannot proceed to job dispatch if consent status is anything other than `granted`

### Mid-Request Revocation Handling

If consent is revoked **after** a job is dispatched but **before** the worker writes its result:

1. Consent store publishes a revocation event (Redis pub/sub channel: `consent.revoked.{creator_id}`)
2. Active workers for that `creator_id` subscribe to this channel; on revocation event received, they cancel the in-progress job and discard any partial result
3. Job is marked `cancelled_by_revocation` in the job store
4. Fan/creator receives: "Generation cancelled — creator updated their consent settings"
5. **SLA: revocation must pull all in-flight and stored generated content within 60 seconds** (system requirement, not just legal)

Workers must: (a) check consent store before writing result, even if not triggered by pub/sub. Both guards run.

### Consent Store Architecture

- Storage: PostgreSQL table `creator_consents`, indexed on `(creator_id, modality)`
- NOT Redis (consent is authoritative data, not cache) 
- Creator-id namespaced; exportable and deletable (data residency lens)

### Rejected Alternatives

| Alternative | Rejected reason |
|-------------|----------------|
| Cache consent in orchestration (e.g., 5-min TTL) | Violates 60-second revocation SLA. Cached state would allow generation after revocation. |
| Pass consent token to providers | Providers have no business receiving consent logic. Also a data residency violation — consent belongs to 7of1, not providers. |
| Check consent only at request ingress (Hermes) | Orchestration is the enforcement layer; surface layers can be replaced. Consent must be enforced at the deepest safe chokepoint before dispatch. |

---

## Decision 3 — Per-Fan Rate Limiting and Tier Enforcement

### Context

§11 states orchestration checks consent + tier but does not specify the per-fan usage counter schema, the enforcement point, or what happens when a free fan hits the limit. This is a monetization-critical gap.

### Decision

**Tier enforcement and per-fan rate limiting sit in the orchestration layer, after consent check and before job dispatch. Enforcement is in the backend; surface layers cannot bypass it.**

### Request Path Order (Orchestration Layer)

```
1. Receive generation request (creator_id, fan_id, modality, payload)
2. Query consent → denied/revoked → return 403 immediately
3. Query tier limits for fan_id + creator_id → check usage counter
4. If limit reached → return 429 with upgrade prompt payload → STOP
5. Increment usage counter atomically (Redis INCR with TTL)
6. Enqueue job → return { job_id, status: "queued" }
```

### Per-Fan Usage Counter Schema

**Redis key:** `usage:{fan_id}:{creator_id}:{modality}:{window}`  
**Example:** `usage:fan-uuid:creator-uuid:voice:2026-05-24` (daily window)

**PostgreSQL audit table** (for billing reconciliation):

```sql
CREATE TABLE usage_counters (
  fan_id        UUID NOT NULL,
  creator_id    UUID NOT NULL,
  modality      TEXT NOT NULL,          -- 'voice', 'video', 'image', 'text'
  window_start  TIMESTAMPTZ NOT NULL,   -- truncated to window boundary
  window_size   TEXT NOT NULL,          -- 'daily', 'weekly', 'monthly'
  count         INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (fan_id, creator_id, modality, window_start, window_size)
);
CREATE INDEX ON usage_counters (creator_id, modality, window_start);
```

Redis is the hot path (atomic INCR, microsecond latency). PostgreSQL is the audit trail (async write, best-effort sync).

### On Limit Reached

Surface layer receives:
```json
{
  "error": "rate_limit_reached",
  "modality": "voice",
  "limit": 3,
  "window": "daily",
  "reset_at": "ISO8601",
  "upgrade_prompt": {
    "message": "You've used your 3 free voice notes today. Upgrade to hear more from [Creator].",
    "cta": "Unlock unlimited voice notes",
    "inline_upgrade_url": "/creator/{creator_id}/upgrade"
  }
}
```

**Critical:** The upgrade prompt renders inline within the webview. `inline_upgrade_url` is a relative path within the fan page — no external redirect. Fan never leaves the IG/TikTok webview. (Webview compatibility lens — see Decision 4.)

**Never silently drop.** Fan must receive a clear gate with an upgrade path.

### Tier Limits Configuration

Tier limits are creator-configurable per modality and stored in the creator config table, not hardcoded. Default free tier:

| Modality | Free limit | Window |
|----------|-----------|--------|
| Text | 20 | daily |
| Voice | 3 | daily |
| Image | 2 | daily |
| Video | 1 | weekly |

### Rejected Alternatives

| Alternative | Rejected reason |
|-------------|----------------|
| Surface layer (Hermes) enforcement | Can be bypassed when surface layer is swapped or called directly. All monetization enforcement is backend-side. |
| Silent drop on limit | Violates user trust and monetization intent. Fan does not know why generation stopped. |
| Global per-creator rate limit only | Per-fan limits are required for fair tier enforcement; a single power fan could exhaust a creator's global quota. |

---

## Decision 4 — Webview Compatibility Constraints in the Surface Layer

### Context

The fan page must work inside Instagram and TikTok in-app browsers. These webviews are highly restricted environments that break standard web APIs. This is a hard engineering constraint, not a UX preference.

### Decision

**The fan page is engineered as a webview-first surface. All flows complete inline within the webview context. No APIs or patterns that are known to break in IG/TikTok webviews are used.**

### Prohibited Patterns (Hard Constraints)

| Pattern | Why Prohibited |
|---------|---------------|
| `window.open()` for OAuth | IG/TikTok webview blocks popup windows; OAuth flow never completes |
| Stripe Checkout hosted redirect | Navigates away from webview; session is lost when user returns |
| `navigator.clipboard` API | Blocked in most in-app browsers |
| `navigator.share()` | Inconsistent/blocked in webviews |
| WebRTC (`getUserMedia`, `RTCPeerConnection`) | Blocked in IG/TikTok webviews |
| Service Workers | Not supported in IG webview |
| Push notification permission requests | Blocked by webview |
| `localStorage` cross-origin reads | Partitioned in webviews; cross-origin reads fail silently |
| `window.location.href` to external payment page | Breaks session; back-navigation not guaranteed |

### Required Patterns

| Capability | Required Pattern |
|------------|-----------------|
| **Authentication** | Magic link or OTP delivered via Telegram/SMS; user enters OTP inline. No OAuth popup. |
| **Payment** | Stripe Payment Element (embedded, not Checkout redirect). Card collected inline, payment intent created server-side. |
| **Tier upgrade** | Inline panel within fan page; payment completes in-place; page state updates without full navigation. |
| **Content delivery** | All media (voice, video, image) served from 7of1 CDN with direct `<audio>` / `<video>` / `<img>` tags. No third-party player embeds that require popup auth. |
| **Session persistence** | JWT stored in `sessionStorage` (not `localStorage`); refreshed on every page load via OTP or magic link re-auth if expired. |

### Webview Detection and Graceful Degradation

Detect IG/TikTok webview via `navigator.userAgent` on the server side (or client-side UA sniff as secondary signal). When webview is detected: disable any prohibited API calls proactively rather than catching failures. This prevents silent failures that are hard to debug.

### Rollback Path

If a specific embedded payment provider breaks in future webview updates: swap to an alternative embedded provider via the provider adapter interface. The fallback is always another embedded provider — never a redirect-based flow.

---

## Summary of Decisions

| Decision | Chosen approach | Key invariant |
|----------|----------------|---------------|
| Async queue | BullMQ (Redis), workers read from queue | Surface layer never awaits generation; always gets job_id in ≤200ms |
| Consent gate | Live query at dispatch time, never cached | Revocation pulls content within 60s; workers check before writing result |
| Tier enforcement | Orchestration layer, Redis counter, PostgreSQL audit | Limit hit → upgrade prompt (inline), never silent drop |
| Webview | No popups, no redirects, Stripe embedded, OTP auth | All fan flows complete inside the webview context |
