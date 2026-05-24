import type {
  GenerationJobStatus,
  Locale,
  ModerationResult,
} from './platform';

// ─── Source citations ─────────────────────────────────────────────────────────

export interface SourceCitation {
  sourceId: string;       // RAG chunk ID
  excerpt: string;        // relevant excerpt shown to fan
  relevanceScore: number; // 0–1, from RAG retrieval
}

// ─── Response variants ────────────────────────────────────────────────────────

export interface TwinTextResponse {
  type: 'text';
  jobId: string;
  creatorId: string;
  fanId: string;
  text: string;
  locale: Locale;
  moderationResult: ModerationResult;
  sourceCitations: SourceCitation[];
  generatedAt: string; // ISO 8601
}

export interface TwinVoiceResponse {
  type: 'voice';
  jobId: string;
  creatorId: string;
  fanId: string;
  voiceUrl: string;       // signed CDN URL, 1-hour TTL
  durationMs: number;
  transcriptText: string; // accessibility + moderation fallback
  locale: Locale;
  moderationResult: ModerationResult;
  generatedAt: string;    // ISO 8601
}

export interface TwinVideoResponse {
  type: 'video';
  jobId: string;
  creatorId: string;
  fanId: string;
  videoUrl: string;       // signed CDN URL, 24-hour TTL
  thumbnailUrl: string;
  durationMs: number;
  locale: Locale;
  moderationResult: ModerationResult;
  generatedAt: string;    // ISO 8601
}

export type TwinResponse =
  | TwinTextResponse
  | TwinVoiceResponse
  | TwinVideoResponse;

// ─── Job status polling ───────────────────────────────────────────────────────

// Frontend polls GET /api/jobs/:jobId/status until status is terminal.
// Never subscribe to a blocking SSE on a user-facing request — all generation is async.

export interface JobStatusResponse {
  jobId: string;
  status: GenerationJobStatus;
  response: TwinResponse | null;   // non-null only when status === 'done'
  estimatedWaitMs: number | null;  // hint for polling interval
  error: JobError | null;
}

export interface JobError {
  code: 'moderation_blocked' | 'consent_revoked' | 'provider_error' | 'quota_exceeded';
  message: string;
}
