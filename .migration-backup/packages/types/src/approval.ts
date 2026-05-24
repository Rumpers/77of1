import type { ContentType } from "./platform";

// ─── Approval payload ─────────────────────────────────────────────────────────

export type ContentApprovalStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "expired";

export interface ContentApprovalPayload {
  approvalId: string;
  creatorId: string;
  fanId: string;
  jobId: string;
  contentType: ContentType;
  previewUrl: string | null;        // null for text-only content
  previewText: string | null;       // non-null for text; may be truncated for voice transcript
  requestedAt: string;              // ISO 8601
  expiresAt: string;                // ISO 8601 — auto-rejected after expiry
  status: ContentApprovalStatus;
  reviewedAt: string | null;        // ISO 8601; null until reviewed
  reviewerCreatorId: string | null; // for multi-account creators; null = solo account
  rejectionReason: string | null;   // required when status === 'rejected'
}

// ─── Webhook event types ──────────────────────────────────────────────────────

export type JobStatusWebhookEventType =
  | "job.queued"
  | "job.processing"
  | "job.completed"
  | "job.failed"
  | "job.cancelled"
  | "approval.requested"
  | "approval.approved"
  | "approval.rejected"
  | "approval.expired";

export interface JobStatusWebhookEvent {
  eventId: string;             // idempotency key; deduplicate on consumer side
  eventType: JobStatusWebhookEventType;
  jobId: string;
  creatorId: string;
  fanId: string;
  timestamp: string;           // ISO 8601
  payload: ContentApprovalPayload | null;
  // payload is non-null on: approval.requested, approval.approved,
  // approval.rejected, approval.expired
  // payload is null on: job.* events (use JobStatusResponse for those)
}

// ─── Hermes approval decision ─────────────────────────────────────────────────

// Hermes sends this back to the Platform after creator taps approve/reject
export interface ApprovalDecision {
  approvalId: string;
  decision: "approved" | "rejected";
  rejectionReason?: string;    // required when decision === 'rejected'
  decidedAt: string;           // ISO 8601
  reviewerCreatorId: string;
}
