// ElevenLabs voice provider stub — OF-109 (Platform Slice 3.3)
// NOT wired by default. Activate with: VOICE_PROVIDER=elevenlabs
// Full implementation follows GMI voice evaluation (OF-50 Slice 3.1).
// Exists to prove provider portability: swapping voice provider = one env var.

import type {
  IVoiceProvider,
  VoiceGenerationInput,
  VoiceGenerationResult,
  VoiceJobStatus,
} from "../interfaces.js";

export class ElevenLabsVoiceProvider implements IVoiceProvider {
  async enqueueVoiceGeneration(
    input: VoiceGenerationInput
  ): Promise<VoiceGenerationResult> {
    console.log(
      `[elevenlabs-voice] enqueueVoiceGeneration stub creator=${input.creatorId}` +
        ` lang=${input.languageCode}`
    );
    const providerJobId = `stub-${crypto.randomUUID()}`;
    return { providerJobId };
  }

  async getJobStatus(providerJobId: string): Promise<VoiceJobStatus> {
    console.log(
      `[elevenlabs-voice] getJobStatus stub providerJobId=${providerJobId}`
    );
    return { status: "pending" };
  }
}
