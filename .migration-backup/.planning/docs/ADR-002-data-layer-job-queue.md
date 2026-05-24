# ADR-002: Data Layer and Job Queue Selection

**Status:** Accepted  
**Date:** 2026-05-24  
**Author:** CTO  
**Scope:** Phase 1 infrastructure — data persistence and async generation queue  
**Parent issue:** [OF-15](/OF/issues/OF-15) · Derived from [OF-7](/OF/issues/OF-7) §16-C9

---

## Decision

**Data layer:** Supabase (managed Postgres + RLS + Auth + Storage) hosted in `ap-northeast-1` (Tokyo) for JP-primary deployment; `ap-southeast-1` (Singapore) for TW-primary deployment.

**Job queue:** BullMQ on Upstash Redis (Pay-as-you-go tier), with a thin `QueueAdapter` interface as the portability boundary.

---

## Context

[OF-7](/OF/issues/OF-7) §16 specifies capability requirements: Postgres-compatible with row-level security; Redis-backed job queue with cancellation by `creator_id` / `consent_grant_id` within a 60-second SLA. Vendor names (Supabase, BullMQ) appeared in the PRD review questions but were not formally decided. This ADR closes that gap before Phase 1 begins.

---

## Rationale

### Data Layer — Supabase

**Region coverage (APPI/PDPA):**

- Japan (APPI): Supabase offers `ap-northeast-1` (Tokyo AWS region) as a selectable specific region. Data stays in-country. APPI is satisfied without cross-border transfer handling.
- Taiwan (PDPA): Supabase has no Taiwan region. Singapore (`ap-southeast-1`) is the closest. Taiwan PDPA imposes **no comprehensive data localization obligation** — cross-border transfers are generally permitted unless competent authorities restrict them. No sector-specific order restricts live-streaming creator data to Taiwan. Singapore hosting is compliant today. **Lens applied: Data residency and ownership** — this must be re-evaluated if PDPA regulations tighten; note it as a monitoring item.

**Build-vs-buy:**

Supabase bundles managed Postgres, built-in Row Level Security enforcement, Auth, Storage, and a Studio UI. Building equivalent capabilities on self-hosted Postgres would require managing connection poolers (PgBouncer), backup pipelines, Auth middleware, and S3-compatible storage. Supabase's open-source codebase means ejecting to self-hosted is an option if vendor risk materializes. **Lens applied: Build-vs-buy** — managed service preferred; self-hosted Postgres is the documented fallback.

**Row Level Security multi-tenancy:**

Creator persona data (conversation history, LoRA adapter metadata, RAG index entries, consent records) is stored with `creator_id` as a first-class column on every table. RLS policies enforce isolation at the database layer:

```sql
CREATE POLICY creator_row_isolation ON creator_data
  USING (creator_id = current_setting('app.current_creator_id')::uuid);
```

Fan-generated session data uses `fan_session_id` as an additional isolation key beneath `creator_id`. No known RLS correctness issues at the multi-tenant isolation level we require (creator-to-creator isolation, not row-per-consumer scale).

**Portability:** Supabase Postgres is standard Postgres. Migrating to Cloud SQL, RDS, or Neon requires a `pg_dump` / schema migration — no proprietary extensions are mandatory. Storage and Auth can be replaced independently. **Lens applied: Provider portability** — no proprietary lock-in beyond the managed service wrapper.

**Exportability/deletability:** All `creator_id`-namespaced rows are selectable and deletable by `creator_id`. Supabase Storage objects are namespaced by bucket path (`{creator_id}/...`). Full export and deletion is executable via standard SQL + Storage API calls. **Lens applied: Data residency and ownership** — export and delete contracts are satisfied.

---

### Job Queue — BullMQ on Upstash Redis

**Cancellation-by-key (60s SLA):**

BullMQ provides cooperative cancellation via `AbortSignal`. Calling `worker.cancelJob(jobId)` aborts the signal; the processor must listen for it and halt. Signal propagation is near-instantaneous (sub-second) — the SLA concern is how quickly the processor observes the signal, not BullMQ latency.

BullMQ does not natively index jobs by `creator_id` or `consent_grant_id`. We satisfy the cancellation-by-key requirement with a Redis side-index:

```
SADD job_index:{creator_id} {jobId}
SADD job_index:grant:{consent_grant_id} {jobId}
```

On revocation: look up the index, call `cancelJob(jobId)` for each entry, clean the index. Total round-trip is O(active jobs per creator), which at our scale is typically 1–3 concurrent jobs. **60-second SLA is achievable** with proper `AbortSignal` handling in every worker — this is a mandatory implementation contract (see Constraints below).

**Feature coverage for §16-C8:**

| Requirement | BullMQ support |
|---|---|
| Retry with exponential backoff | ✅ Native (`backoff: { type: 'exponential', delay: 2000 }`) |
| Dead letter queue | ✅ Failed jobs retained in `failed` set with configurable `failedJobsHistoryLimit`; separate DLQ queue via event listener |
| Priority lanes | ✅ `priority` field per job; higher value = higher priority |
| Job cancellation | ✅ Cooperative via `AbortSignal` (implementation contract required) |
| Redis-backed | ✅ Core design |

**Async by default:** All generation tasks (voice synthesis, image generation, video assembly) are enqueued and processed out of the user-facing request path. **Lens applied: Async by default** — satisfied by BullMQ design.

**Provider portability:** A `QueueAdapter` interface wraps all BullMQ calls. Swapping the queue provider changes the adapter implementation only — orchestration code is unaffected. **Lens applied: Provider portability** — required interface defined in Constraints.

---

## Rejected Alternatives

### Self-hosted Postgres + RLS

**Rejected because:** Supabase's open-source repo means we can self-host identically if needed. But for Phase 1 (prototype → early production), the operational overhead of managing PgBouncer, backups, Auth, and Storage separately is not justified. Self-hosted remains the documented fallback if Supabase region availability becomes a blocker or vendor risk materializes.

### Temporal

**Rejected because:** Temporal requires a separate Temporal server deployment (Temporal Cloud or self-hosted cluster) in addition to the database and Redis infrastructure. It adds significant operational overhead for a capability set that BullMQ already covers. ToolJet migrated from Temporal to BullMQ citing "significantly simplified deployment while maintaining all existing functionality." Our job model — discrete generation tasks with retry, cancellation, and status tracking — maps cleanly to BullMQ without needing Temporal's durable execution history. Temporal would be reconsidered only if we add multi-step sagas with sub-workflow fan-out that require history replay.

### Redis Cloud (instead of Upstash)

Not rejected — Redis Cloud is a viable alternative to Upstash. Upstash is preferred for Phase 1 because it has APAC regions (Tokyo, Singapore), a serverless pay-per-use billing model that matches our early traffic profile, and native BullMQ support documentation. Redis Cloud is the documented fallback if Upstash availability or pricing becomes an issue at scale.

---

## Constraints Imposed on Implementation

### C1 — AbortSignal contract (mandatory)

Every BullMQ worker processor MUST implement `AbortSignal` handling. A processor that does not check the signal and halt will not respect the 60-second cancellation SLA. This is a code-review gate for all worker implementations.

```typescript
// Required pattern for all generation workers
async function processor(job: Job, token: string, signal: AbortSignal) {
  signal.addEventListener('abort', () => { /* cleanup */ throw new Error('cancelled'); });
  // check signal.aborted at each async boundary
}
```

### C2 — Redis side-index for cancel-by-key

All job enqueue operations MUST atomically register the job in `job_index:{creator_id}` and `job_index:grant:{consent_grant_id}`. All job completion/failure handlers MUST remove entries. The `ConsentRevocationService` uses this index as its cancellation lookup — without it, the 60-second SLA cannot be met.

### C3 — Supabase region selection per deployment target

| Deployment | Supabase region | AWS region |
|---|---|---|
| Japan primary | Northeast Asia (Tokyo) | `ap-northeast-1` |
| Taiwan primary | Southeast Asia (Singapore) | `ap-southeast-1` |
| Development/staging | Southeast Asia (Singapore) | `ap-southeast-1` |

The region must be set at project creation time. Migration between regions requires data export and re-import.

### C4 — QueueAdapter interface

All BullMQ interactions go through a `QueueAdapter` interface. Direct BullMQ SDK imports are prohibited outside the adapter module. Swapping queue providers = new adapter implementation, zero orchestration changes.

```typescript
interface QueueAdapter {
  enqueue(queueName: string, jobData: JobPayload, opts: EnqueueOptions): Promise<string>;
  cancel(jobId: string): Promise<void>;
  cancelByCreator(creatorId: string): Promise<void>;
  cancelByGrant(consentGrantId: string): Promise<void>;
  getStatus(jobId: string): Promise<JobStatus>;
}
```

### C5 — RLS policy on every creator-data table

Every table storing creator-namespaced data requires: (a) a `creator_id uuid NOT NULL` column, (b) an RLS policy enforcing row isolation, (c) RLS enabled with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`. This is a schema review gate.

### C6 — Rollback path

- **Supabase:** Daily automated backups (Pro plan, 7-day retention). Point-in-time recovery via Supabase dashboard. **Rollback path:** restore from backup to a new project, update connection strings in secrets manager.
- **Upstash Redis:** BullMQ job data is ephemeral by design. Failed jobs are retained in the `failed` set. **Rollback path:** re-enqueue failed jobs from the `failed` set; no data loss risk for the queue layer since job inputs are stored in the primary DB.

---

## Cost Estimates

All estimates are per-creator-per-month at 100 active creators (Phase 1 target scale). Costs scale approximately linearly with creator count; recheck at 500+ creators.

| Component | Provider | Plan | Monthly base | Per-creator @ 100 |
|---|---|---|---|---|
| Managed Postgres | Supabase | Pro ($25/mo) | $25 | ~$0.25 |
| Storage (LoRA, video training data) | Supabase Storage | $0.021/GB beyond 100GB included | ~$0 at launch | ~$0.05 (est. 5GB/creator avg) |
| Job queue (Redis) | Upstash | Pay-as-you-go ($0.2/M commands) | ~$10 min | ~$0.10 |
| **Data layer + queue total** | | | **~$35–45/mo** | **~$0.35–0.45/creator/mo** |

*Note: compute costs (Supabase Pro includes `2-core / 1GB RAM` compute) and voice/video/LLM API costs are excluded — those are covered in the provider selection ADRs for each capability slot.*

At 1,000 creators, storage add-ons and Upstash commands scale; estimated total: ~$150–200/month for data layer + queue (~$0.15–0.20/creator/month at scale due to shared base costs).

---

## Sign-off

CTO self-review (authorized per issue acceptance criteria).

- [x] Supabase JP (`ap-northeast-1` / Tokyo) confirmed available
- [x] TW PDPA localization — no strict mandate; Singapore region compliant; monitoring item noted
- [x] BullMQ cancellation-by-key achievable within 60s SLA with AbortSignal contract + Redis index
- [x] All §16-C8 features confirmed (retry/backoff/DLQ/priority)
- [x] Temporal rejected with rationale
- [x] Cost estimates provided
- [x] Rollback paths documented (**Lens applied: Rollback path**)
- [x] Adapter interface defined (**Lens applied: Provider portability**)
- [x] Data residency and exportability confirmed (**Lens applied: Data residency and ownership**)

**ADR status:** Accepted. Ready to hand to engineering for Phase 1 kickoff.
