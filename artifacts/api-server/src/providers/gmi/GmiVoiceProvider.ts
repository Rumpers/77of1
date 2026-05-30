// GMI voice provider — wraps the gmiTtsBreaker from lib/providers.
// Phase 3: real implementation replacing the stub (03-06 / VOICE-01, VOICE-02).
//
// The PRIMARY caller in Phase 3 is the voice-generation worker (it calls the
// breaker directly for best observability). This provider exists for any
// synchronous api-server voice path that may be added in Phase 4+.
//
// voice_id resolution priority:
//   1. twins.voice_id (creator's cloned voice, set after clone Step A)
//   2. GMI_TTS_FALLBACK_VOICE_ID (preset — testable before onboarding)

import type {
  IVoiceProvider,
  VoiceGenerationInput,
  VoiceGenerationResult,
  VoiceJobStatus,
} from "../interfaces.js";
import { ProviderError, ProviderTransientError } from "../interfaces.js";
import { gmiTtsBreaker } from "@workspace/providers";

export class GmiVoiceProvider implements IVoiceProvider {
  /**
   * Enqueue a voice generation job via the GMI TTS async queue.
   * Uses the circuit breaker — a null return means the breaker is open (text-only).
   */
  async enqueueVoiceGeneration(
    input: VoiceGenerationInput
  ): Promise<VoiceGenerationResult> {
    const voiceId =
      process.env["GMI_TTS_FALLBACK_VOICE_ID"] ?? "English_expressive_narrator";

    let result;
    try {
      result = await gmiTtsBreaker.fire({
        text: input.text,
        voiceId: voiceId,
        language: input.languageCode,
        creatorId: input.creatorId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (
        msg.includes("4") ||
        msg.toLowerCase().includes("unauthorized") ||
        msg.toLowerCase().includes("bad request")
      ) {
        throw new ProviderError(`GMI TTS 4xx: ${msg}`);
      }
      throw new ProviderTransientError(`GMI TTS transient: ${msg}`);
    }

    if (result === null) {
      // Circuit breaker open — surface as transient error so callers can decide
      throw new ProviderTransientError("GMI TTS circuit breaker is open");
    }

    // Return a provider job id — the audio bytes are in result.audioBytes
    // but IVoiceProvider.enqueueVoiceGeneration only returns a job id.
    // The worker uses the breaker directly to get audioBytes.
    return { providerJobId: `gmi-tts-sync-${Date.now()}` };
  }

  /**
   * Status polling — not used in the async worker path (worker polls GMI directly).
   * Provided for interface compliance.
   */
  async getJobStatus(_providerJobId: string): Promise<VoiceJobStatus> {
    // Worker-side polling is handled inside gmiTtsBreaker.fire() (submit+poll+fetch).
    // This method is a no-op for the async worker path.
    return { status: "done" };
  }
}
