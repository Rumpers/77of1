// ─── Shared primitives ───────────────────────────────────────────────────────

// BCP 47 locale codes supported by the twin engine.
export type Locale = 'en' | 'ja' | 'zh-TW' | 'zh-CN' | 'ko' | 'th' | 'id' | 'vi' | 'tl';
export type ServiceTier = 'free' | 'standard' | 'premium';

// Content modality for a paid generation job.
export type ContentType = 'text' | 'voice' | 'video' | 'image';

export type GenerationJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'   // terminal: success — outputPayload is non-null
  | 'failed'      // terminal: error — errorCode/errorMessage are non-null
  | 'cancelled';

// ─── creator_config ──────────────────────────────────────────────────────────

export type ConsentLevel = 'text_only' | 'text_voice' | 'text_voice_video' | 'none';

export interface CreatorConfig {
  creatorId: string;            // stable UUID, creator-namespaced
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  personaPrompt: string | null; // system prompt seed for AI twin
  voiceModelId: string | null;  // provider-agnostic adapter key
  videoModelId: string | null;  // provider-agnostic adapter key
  activeConsentLevel: ConsentLevel;
  serviceTier: ServiceTier;
  locales: Locale[];
  createdAt: string;            // ISO 8601
  updatedAt: string;            // ISO 8601
}

// ─── consent_grants ──────────────────────────────────────────────────────────

// Consent is checked live at generation time — never cache this shape.
// Revocation must propagate to content removal within 60 seconds.
export interface ConsentGrant {
  grantId: string;
  creatorId: string;
  fanId: string;
  textEnabled: boolean;
  voiceEnabled: boolean;
  videoEnabled: boolean;
  grantedAt: string;            // ISO 8601
  revokedAt: string | null;     // ISO 8601; null = still active
}

// ─── generation_job ──────────────────────────────────────────────────────────

export interface ModerationResult {
  passed: boolean;
  flaggedCategories: string[];  // triggered categories e.g. "explicit", "harassment"
  confidence: number;           // 0–1 risk score; higher = more risk
}

export interface GenerationJobOutput {
  text?: string;
  voiceUrl?: string;            // signed CDN URL, 1-hour TTL
  videoUrl?: string;            // signed CDN URL, 24-hour TTL
  imageUrl?: string;
  durationMs?: number;
  moderationResult: ModerationResult;
}

export interface GenerationJobInput {
  prompt: string;
  locale: Locale;
  contentType: ContentType;
  providerKey: string | null;   // null = use default from creator_config
  consentGrantId: string;       // must be active at queue time AND generation time
}

// generation_job is always async; callers queue and poll — never await inline.
export interface GenerationJob {
  jobId: string;
  creatorId: string;
  fanId: string;
  jobType: ContentType;
  status: GenerationJobStatus;
  inputPayload: GenerationJobInput;
  outputPayload: GenerationJobOutput | null;
  errorCode: string | null;
  errorMessage: string | null;
  queuedAt: string;             // ISO 8601
  startedAt: string | null;     // ISO 8601
  completedAt: string | null;   // ISO 8601
  estimatedDurationMs: number | null;
}

// ─── Replit Auth session ─────────────────────────────────────────────────────

export type ReplitUserType = 'fan' | 'creator';

export interface ReplitAuthSession {
  userId: string;               // Replit user ID
  userType: ReplitUserType;
  linkedCreatorId?: string;     // present when userType === 'creator'
  linkedFanId?: string;         // present when userType === 'fan'
  accessToken: string;
  expiresAt: string;            // ISO 8601
}
