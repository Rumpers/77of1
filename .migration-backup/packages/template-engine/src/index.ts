export { TemplateEngine } from "./engine.js";
export { resolveModality } from "./degrade.js";
export type {
  Modality,
  ModalityConsent,
  SlotDefinition,
  TemplateDefinition,
  ResolvedSlot,
  ResolvedTemplate,
  DegradedReason,
} from "./types.js";
export { DEGRADATION_CHAIN } from "./types.js";

// Slice 2.2 — Shareable content generation
export { ShareableContentGenerator } from "./shareable-generator.js";
export type {
  ShareableTemplate,
  ShareableCreatorContext,
  ShareableContent,
} from "./shareable-generator.js";
export { computeVariationParams } from "./variation.js";
export type { VariationParams } from "./variation.js";
export type { ShareableSurface } from "./shareable-prompt.js";
export { buildShareableSystemPrompt, buildUserPrompt } from "./shareable-prompt.js";
export { formatForSurface } from "./formatter.js";
export type { FormattedContent } from "./formatter.js";
export { retrieveRagChunks } from "./rag.js";
export type { RagDbClient, RagChunk, EmbedProvider } from "./rag.js";
export type { ShareablePersonaParams } from "./shareable-prompt.js";
