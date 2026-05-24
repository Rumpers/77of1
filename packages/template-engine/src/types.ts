// ─── Modalities ───────────────────────────────────────────────────────────────

export type Modality = "text" | "voice" | "video" | "image";

// Degradation chain per preferred modality:
//   video → voice → text
//   voice → text
//   image → text
//   text  → text (no degradation possible)
export const DEGRADATION_CHAIN: Record<Modality, Modality[]> = {
  video: ["video", "voice", "text"],
  voice: ["voice", "text"],
  image: ["image", "text"],
  text: ["text"],
};

// ─── Slot definitions ─────────────────────────────────────────────────────────

export interface SlotDefinition {
  /** Unique name within the template, e.g. "hero", "call_to_action" */
  name: string;
  /** The creator's preferred output modality for this slot */
  preferredModality: Modality;
  /** Human-readable description of what this slot carries */
  description?: string;
}

// ─── Template definition ──────────────────────────────────────────────────────

export interface TemplateDefinition {
  templateId: string;
  name: string;
  description?: string;
  slots: SlotDefinition[];
}

// ─── Consent shape consumed by the engine ─────────────────────────────────────
// Mirrors the relevant fields from ConsentGrant in @7of1/types/platform.ts.
// The engine only cares about which modalities are enabled — it does not perform
// the live consent check (that is OF-63's responsibility).

export interface ModalityConsent {
  textEnabled: boolean;
  voiceEnabled: boolean;
  videoEnabled: boolean;
  imageEnabled: boolean;
}

// ─── Resolution output ────────────────────────────────────────────────────────

/** Reason recorded when a slot could not use its preferred modality. */
export type DegradedReason =
  | "preferred_available"
  | "no_video_consent"
  | "no_voice_consent"
  | "no_image_consent";

export interface ResolvedSlot {
  name: string;
  preferredModality: Modality;
  resolvedModality: Modality;
  /** Why the preferred modality was or was not used. */
  degradedReason: DegradedReason;
  /** True when the slot could not be satisfied at the preferred modality. */
  wasDegraded: boolean;
}

export interface ResolvedTemplate {
  templateId: string;
  slots: ResolvedSlot[];
  /** Convenience flag: false when any slot was degraded. */
  allSlotsAtPreferred: boolean;
}
