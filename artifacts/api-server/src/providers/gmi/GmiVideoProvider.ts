// GMI video provider stub — OF-109 (Platform Slice 3.3)
// Real implementation pending GMI video evaluation (OF-50 Slice 3.3).
// Stub compiles clean against IVideoProvider so the queue infrastructure
// can dispatch video jobs without a live GMI video endpoint.

import type {
  IVideoProvider,
  VideoGenerationInput,
  VideoGenerationResult,
  VideoJobStatus,
} from "../interfaces.js";

export class GmiVideoProvider implements IVideoProvider {
  async enqueueVideoGeneration(
    input: VideoGenerationInput
  ): Promise<VideoGenerationResult> {
    console.log(
      `[gmi-video] enqueueVideoGeneration stub creator=${input.creatorId}` +
        ` avatar=${input.avatarId} lang=${input.languageCode}`
    );
    const providerJobId = `stub-${crypto.randomUUID()}`;
    return { providerJobId };
  }

  async getJobStatus(providerJobId: string): Promise<VideoJobStatus> {
    console.log(`[gmi-video] getJobStatus stub providerJobId=${providerJobId}`);
    return { status: "pending" };
  }
}
