// Unit test: GMI voice/video stubs + provider swap verification (OF-109)
// Run: pnpm tsx src/providers/__tests__/provider-stubs.test.ts
// No external deps — all assertions against stub behaviour only.

import { GmiVoiceProvider } from "../gmi/GmiVoiceProvider.js";
import { GmiVideoProvider } from "../gmi/GmiVideoProvider.js";
import { ElevenLabsVoiceProvider } from "../external/ElevenLabsVoiceProvider.js";
import { HeyGenVideoProvider } from "../external/HeyGenVideoProvider.js";
import {
  createRegistry,
  getVoiceProvider,
  getVideoProvider,
  resetProviderRegistry,
} from "../registry.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

// ── 1. GmiVoiceProvider stub ─────────────────────────────────────────────────
console.log("\n1. GmiVoiceProvider stub");

const voiceProvider = new GmiVoiceProvider();
const voiceResult = await voiceProvider.enqueueVoiceGeneration({
  creatorId: "creator-1",
  text: "Hello from the creator.",
  voiceModelId: "gmi-voice-v1",
  languageCode: "en",
});

assert(
  typeof voiceResult.providerJobId === "string",
  "enqueueVoiceGeneration() returns providerJobId string"
);
assert(
  voiceResult.providerJobId.startsWith("stub-"),
  'providerJobId starts with "stub-"'
);

const voiceStatus = await voiceProvider.getJobStatus(voiceResult.providerJobId);
assert(voiceStatus.status === "pending", 'getJobStatus() returns status "pending"');

// ── 2. GmiVideoProvider stub ─────────────────────────────────────────────────
console.log("\n2. GmiVideoProvider stub");

const videoProvider = new GmiVideoProvider();
const videoResult = await videoProvider.enqueueVideoGeneration({
  creatorId: "creator-1",
  script: "Hi, thanks for subscribing!",
  avatarId: "avatar-gmi-v1",
  languageCode: "ja",
});

assert(
  typeof videoResult.providerJobId === "string",
  "enqueueVideoGeneration() returns providerJobId string"
);
assert(
  videoResult.providerJobId.startsWith("stub-"),
  'providerJobId starts with "stub-"'
);

const videoStatus = await videoProvider.getJobStatus(videoResult.providerJobId);
assert(videoStatus.status === "pending", 'getJobStatus() returns status "pending"');

// ── 3. ElevenLabs fallback stub ──────────────────────────────────────────────
console.log("\n3. ElevenLabsVoiceProvider stub");

const elProvider = new ElevenLabsVoiceProvider();
const elResult = await elProvider.enqueueVoiceGeneration({
  creatorId: "creator-2",
  text: "ElevenLabs stub test.",
  voiceModelId: "eleven-turbo-v2",
  languageCode: "zh-TW",
});

assert(
  typeof elResult.providerJobId === "string",
  "ElevenLabs enqueueVoiceGeneration() returns providerJobId string"
);
assert(
  elResult.providerJobId.startsWith("stub-"),
  'ElevenLabs providerJobId starts with "stub-"'
);

const elStatus = await elProvider.getJobStatus(elResult.providerJobId);
assert(elStatus.status === "pending", 'ElevenLabs getJobStatus() returns "pending"');

// ── 4. HeyGen fallback stub ───────────────────────────────────────────────────
console.log("\n4. HeyGenVideoProvider stub");

const heygenProvider = new HeyGenVideoProvider();
const hgResult = await heygenProvider.enqueueVideoGeneration({
  creatorId: "creator-3",
  script: "HeyGen stub test.",
  avatarId: "heygen-avatar-1",
  languageCode: "en",
});

assert(
  typeof hgResult.providerJobId === "string",
  "HeyGen enqueueVideoGeneration() returns providerJobId string"
);

const hgStatus = await heygenProvider.getJobStatus(hgResult.providerJobId);
assert(hgStatus.status === "pending", 'HeyGen getJobStatus() returns "pending"');

// ── 5. createRegistry('gmi') returns voice + video stubs ─────────────────────
console.log("\n5. createRegistry('gmi')");

// GmiTextProvider checks for GMI_API_KEY at construction time.
// Set a sentinel value so the registry constructor doesn't throw during unit tests
// (no real API calls are made in this test).
const prevGmiKey = process.env["GMI_API_KEY"];
if (!prevGmiKey) process.env["GMI_API_KEY"] = "test-only-not-real";

const registry = createRegistry("gmi");

if (!prevGmiKey) delete process.env["GMI_API_KEY"];
assert(typeof registry.voice === "object", "registry.voice is an object");
assert(typeof registry.video === "object", "registry.video is an object");
assert(typeof registry.text === "object", "registry.text is an object");

const regVoiceResult = await registry.voice.enqueueVoiceGeneration({
  creatorId: "creator-4",
  text: "Registry test.",
  voiceModelId: "gmi-voice-v1",
  languageCode: "en",
});
assert(
  regVoiceResult.providerJobId.startsWith("stub-"),
  "registry.voice.enqueueVoiceGeneration() dispatches without error"
);

const regVideoResult = await registry.video.enqueueVideoGeneration({
  creatorId: "creator-4",
  script: "Registry video test.",
  avatarId: "avatar-1",
  languageCode: "en",
});
assert(
  regVideoResult.providerJobId.startsWith("stub-"),
  "registry.video.enqueueVideoGeneration() dispatches without error"
);

// ── 6. Env var swap: VOICE_PROVIDER=gmi → gmi, VOICE_PROVIDER=elevenlabs → elevenlabs ──
console.log("\n6. Env var swap: VOICE_PROVIDER");

resetProviderRegistry();
process.env["VOICE_PROVIDER"] = "gmi";
const gmiVoice = getVoiceProvider();
assert(gmiVoice instanceof GmiVoiceProvider, "VOICE_PROVIDER=gmi → GmiVoiceProvider");

resetProviderRegistry();
process.env["VOICE_PROVIDER"] = "elevenlabs";
const elVoice = getVoiceProvider();
assert(
  elVoice instanceof ElevenLabsVoiceProvider,
  "VOICE_PROVIDER=elevenlabs → ElevenLabsVoiceProvider"
);

resetProviderRegistry();
process.env["VOICE_PROVIDER"] = "gmi";

// ── 7. Env var swap: VIDEO_PROVIDER=gmi → gmi, VIDEO_PROVIDER=heygen → heygen ──
console.log("\n7. Env var swap: VIDEO_PROVIDER");

resetProviderRegistry();
process.env["VIDEO_PROVIDER"] = "gmi";
const gmiVideo = getVideoProvider();
assert(gmiVideo instanceof GmiVideoProvider, "VIDEO_PROVIDER=gmi → GmiVideoProvider");

resetProviderRegistry();
process.env["VIDEO_PROVIDER"] = "heygen";
const heygenVideo = getVideoProvider();
assert(
  heygenVideo instanceof HeyGenVideoProvider,
  "VIDEO_PROVIDER=heygen → HeyGenVideoProvider"
);

resetProviderRegistry();
delete process.env["VIDEO_PROVIDER"];

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
console.log("All provider stub tests PASSED");
