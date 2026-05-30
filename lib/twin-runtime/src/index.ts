// @workspace/twin-runtime — shared lib for the lala.la twin pipeline.
//
// Consumers: artifacts/api-server (web chat route), artifacts/worker
// (Telegram text-generation job), artifacts/fan-twin (Telegram bot).
//
// Plan 02-06a extracted the original 10 api-server lib files into this
// package so the worker and fan-twin can import them without reaching
// into api-server's source tree. Plus 2 Rule 3 (blocking) additions —
// `logger` and `safety-audit` — that moderation.ts depends on; and a
// new `provider-types` module owning the canonical ModerationResult +
// ProviderError + ProviderTransientError + IModeratorProvider symbols.

// L4/L5/L6 + L1/L3 moderation pipeline (composes the 5 below)
export * from "./moderation.js";

// Provider error taxonomy + moderation result shape
export * from "./provider-types.js";

// Safe-deflection strings (L4)
export * from "./deflections.js";

// Crisis helpline strings (COMPLY-02 / SB 243 self-harm protocol)
export * from "./helplines.js";

// Founder Telegram notification (L5)
export * from "./notify-founder.js";

// Hashed safety-audit row writer (L6)
export * from "./safety-audit.js";

// SB 243 AI disclosure footer (COMPLY-01)
export * from "./disclosure.js";

// Inline locale detection (I18N-02)
export * from "./locale.js";

// LLM system-prompt composition (Character Card V2 + constitution + locale)
export * from "./system-prompt.js";

// Replit Object Storage read of creator-authored constitution.md (PERSONA-02)
export * from "./constitution.js";

// Conversation history persistence (CHAT-04)
export * from "./conversation.js";

// HMAC-signed conversation_id (CHAT-03)
export * from "./hmac-conversation.js";

// Pino structured logger
export * from "./logger.js";

// MOD-07: Crescendo cross-turn escalation scorer
export * from "./escalation.js";

// Voice consent check + enqueue helpers (03-06 / VOICE-01, VOICE-02)
export { shouldGenerateVoice } from "./voice.js";
export { enqueueVoiceJob } from "./voice.js";
export type { TwinVoiceCheck, EnqueueVoiceJobArgs } from "./voice.js";
