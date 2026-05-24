// GMI voice provider stub — OF-109 (Platform Slice 3.3)
// Real implementation pending GMI voice evaluation (OF-50 Slice 3.1).
// Stub compiles clean against IVoiceProvider so the queue infrastructure
// can dispatch voice jobs without a live GMI voice endpoint.

import type {
  IVoiceProvider,
  VoiceGenerationInput,
  VoiceGenerationResult,
  VoiceJobStatus,
} from "../interfaces.js";

export class GmiVoiceProvider implements IVoiceProvider {
  async enqueueVoiceGeneration(
    input: VoiceGenerationInput
  ): Promise<VoiceGenerationResult> {
    console.log(
      `[gmi-voice] enqueueVoiceGeneration stub creator=${input.creatorId}` +
        ` lang=${input.languageCode} voiceModel=${input.voiceModelId}`
    );
    const providerJobId = `stub-${crypto.randomUUID()}`;
    return { providerJobId };
  }

  async getJobStatus(providerJobId: string): Promise<VoiceJobStatus> {
    console.log(`[gmi-voice] getJobStatus stub providerJobId=${providerJobId}`);
    return { status: "pending" };
  }
}
