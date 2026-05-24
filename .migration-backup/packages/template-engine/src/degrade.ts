import type { Modality, ModalityConsent, DegradedReason } from "./types.js";
import { DEGRADATION_CHAIN } from "./types.js";

function isModalityGranted(modality: Modality, consent: ModalityConsent): boolean {
  switch (modality) {
    case "text":  return consent.textEnabled;
    case "voice": return consent.voiceEnabled;
    case "video": return consent.videoEnabled;
    case "image": return consent.imageEnabled;
  }
}

function degradationReasonForMissed(preferred: Modality): DegradedReason {
  switch (preferred) {
    case "video": return "no_video_consent";
    case "voice": return "no_voice_consent";
    case "image": return "no_image_consent";
    case "text":  return "no_video_consent"; // unreachable in practice
  }
}

export interface DegradationResult {
  resolved: Modality;
  degradedReason: DegradedReason;
  wasDegraded: boolean;
}

/**
 * Walk the degradation chain for `preferred` until a consented modality is found.
 * Text is always the final fallback; the chain guarantees a result is returned.
 *
 * Throws only when `textEnabled` is false AND the chain reaches text, which means
 * the caller failed to verify consent before invoking the engine (programmer error).
 */
export function resolveModality(
  preferred: Modality,
  consent: ModalityConsent
): DegradationResult {
  const chain = DEGRADATION_CHAIN[preferred];

  for (const candidate of chain) {
    if (isModalityGranted(candidate, consent)) {
      const wasDegraded = candidate !== preferred;
      return {
        resolved: candidate,
        degradedReason: wasDegraded
          ? degradationReasonForMissed(preferred)
          : "preferred_available",
        wasDegraded,
      };
    }
  }

  // text is always last in every chain; reaching here means textEnabled === false.
  // Surface a clear error rather than silently returning nothing.
  throw new Error(
    `[template-engine] No consented modality found for preferred="${preferred}". ` +
      "textEnabled must be true for any generation to proceed — verify consent before calling resolveModality."
  );
}
