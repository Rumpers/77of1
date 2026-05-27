// HeyGen video provider stub — OF-109 (Platform Slice 3.3)
// NOT wired by default. Activate with: VIDEO_PROVIDER=heygen
// Full implementation follows GMI video evaluation (OF-50 Slice 3.3).
// Exists to prove provider portability: swapping video provider = one env var.

import type {
  IVideoProvider,
  VideoGenerationInput,
  VideoGenerationResult,
  VideoJobStatus,
} from "../interfaces.js";

export class HeyGenVideoProvider implements IVideoProvider {
  async enqueueVideoGeneration(
    input: VideoGenerationInput
  ): Promise<VideoGenerationResult> {
    console.log(
      `[heygen-video] enqueueVideoGeneration stub creator=${input.creatorId}` +
        ` avatar=${input.avatarId}`
    );
    const providerJobId = `stub-${crypto.randomUUID()}`;
    return { providerJobId };
  }

  async getJobStatus(providerJobId: string): Promise<VideoJobStatus> {
    console.log(
      `[heygen-video] getJobStatus stub providerJobId=${providerJobId}`
    );
    return { status: "pending" };
  }
}
