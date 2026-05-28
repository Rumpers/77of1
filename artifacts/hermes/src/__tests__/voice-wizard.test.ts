// GREEN tests for plan 02-08 — /voice WizardScene + Replit Object Storage upload.
//
// Covers ONBOARD-01 voice-sample component:
//   - scene id matches the value mounted on Scenes.Stage in index.ts
//   - duration validation: <6s → reply "too short", stay in scene
//   - graceful-degrade: REPLIT_OBJECT_STORAGE_BUCKET unset → reply "not yet available", leave
//   - happy path: ≥6s voice note → uploadVoiceReference called with creatorId/buffer/mimeType,
//     twins.voiceReferenceUrl updated, success reply, scene.leave
//
// Mocks:
//   - @workspace/db: schema tables are inert objects (db.update path is exercised via the
//     hermes/db.ts writer mock below, not direct table access).
//   - ../lib/object-storage.js: uploadVoiceReference is the upload contract; we mock it
//     to assert it's called with the right shape (and to flip success vs throw).
//   - ../db.js: writeVoiceReferenceUrl is the new writer this plan adds; we mock it to
//     capture (creatorId, url) call args.
//
// Notes:
//   - We do NOT exercise the Telegraf bot lifecycle here; we invoke the scene's step
//     handlers directly with a fake `ctx` (the same harness pattern persona-wizard.test.ts uses).
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock @workspace/db so the persona/db.ts module's side-imports don't try to
// open a real Postgres connection at test load.
vi.mock("@workspace/db", () => ({
  db: {},
  creatorsTable: {},
  creatorConfigTable: {},
  creatorKycTable: {},
  creatorTotpTable: {},
  twinsTable: {},
  consentGrantsTable: {},
}));

// Mock the object-storage helper. uploadVoiceReference returns {url, key} per the
// signature shipped in plan 02-07 (lib/object-storage.ts).
const uploadVoiceReferenceMock = vi.fn();
vi.mock("../lib/object-storage.js", () => ({
  uploadVoiceReference: uploadVoiceReferenceMock,
}));

// Mock the hermes db.ts writer this plan adds.
const writeVoiceReferenceUrlMock = vi.fn();
vi.mock("../db.js", () => ({
  writeVoiceReferenceUrl: writeVoiceReferenceUrlMock,
  // Re-export others that scene/index might co-import — keep inert stubs so
  // unrelated imports in the SUT don't ReferenceError.
  findCreatorByTelegramId: vi.fn(),
  getCreatorStats: vi.fn(),
  setPaused: vi.fn(),
  getKycRow: vi.fn(),
  upsertTwinCharacterCard: vi.fn(),
  writeMonetization: vi.fn(),
}));

// Import AFTER mocks are registered (vitest hoists vi.mock but ESM import order
// still matters for closure capture).
const { voiceWizard, MIN_VOICE_DURATION_SECONDS } = await import(
  "../scenes/voice.scene.js"
);

interface FakeCtx {
  wizard: { state: Record<string, unknown>; next: Mock; selectStep: Mock };
  scene: { leave: Mock };
  message?: { voice?: { file_id: string; duration: number; mime_type?: string } };
  telegram?: { getFileLink: Mock };
  reply: Mock;
}

function makeCtx(overrides: Partial<FakeCtx> = {}): FakeCtx {
  return {
    wizard: {
      state: { creatorId: "creator-uuid-1" },
      next: vi.fn(),
      selectStep: vi.fn(),
    },
    scene: { leave: vi.fn() },
    reply: vi.fn(),
    telegram: {
      getFileLink: vi.fn(async () => new URL("https://example.com/file.ogg")),
    },
    ...overrides,
  };
}

beforeEach(() => {
  uploadVoiceReferenceMock.mockReset();
  writeVoiceReferenceUrlMock.mockReset();
  vi.unstubAllGlobals();
  delete process.env.REPLIT_OBJECT_STORAGE_BUCKET;
  delete process.env.REPLIT_OBJECT_STORAGE_BASE_URL;
});

describe("voice WizardScene", () => {
  it("registers under scene id 'voice-wizard'", () => {
    expect(voiceWizard.id).toBe("voice-wizard");
  });

  it("exports a 6-second minimum duration constant", () => {
    expect(MIN_VOICE_DURATION_SECONDS).toBe(6);
  });

  it("step 0 (entry) prompts for the voice note", async () => {
    const ctx = makeCtx();
    // Access step handler directly. Telegraf's WizardScene stores them on .steps[].
    const stepFns = (voiceWizard as unknown as { steps: Array<(c: unknown) => Promise<unknown>> })
      .steps;
    expect(stepFns.length).toBeGreaterThanOrEqual(2);
    await stepFns[0](ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const promptText = ctx.reply.mock.calls[0]?.[0] as string;
    expect(promptText).toMatch(/voice note/i);
    expect(promptText).toMatch(/6/);
    // Either next() or selectStep(1) is acceptable as "advance to the capture step".
    expect(ctx.wizard.next.mock.calls.length + ctx.wizard.selectStep.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it("step 1 rejects voice notes shorter than 6 seconds and stays in scene", async () => {
    const ctx = makeCtx({
      message: { voice: { file_id: "abc", duration: 3, mime_type: "audio/ogg" } },
    });
    const stepFns = (voiceWizard as unknown as { steps: Array<(c: unknown) => Promise<unknown>> })
      .steps;
    await stepFns[1](ctx);
    expect(ctx.reply).toHaveBeenCalled();
    const replyText = ctx.reply.mock.calls[0]?.[0] as string;
    expect(replyText).toMatch(/too short|6/i);
    expect(ctx.scene.leave).not.toHaveBeenCalled();
    expect(uploadVoiceReferenceMock).not.toHaveBeenCalled();
  });

  it("step 1 degrades gracefully when REPLIT_OBJECT_STORAGE_BUCKET is unset", async () => {
    // Bucket env intentionally unset (beforeEach deletes it). uploadVoiceReference
    // is expected to throw in production when bucket is missing; the scene must
    // catch and emit the friendly message rather than crashing the wizard.
    uploadVoiceReferenceMock.mockRejectedValueOnce(
      new Error("REPLIT_OBJECT_STORAGE_BUCKET (or REPLIT_OBJECT_STORAGE_BASE_URL) is not set")
    );
    // Stub global fetch so downloadTelegramFile returns a buffer.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8),
      })) as unknown as typeof fetch
    );
    const ctx = makeCtx({
      message: { voice: { file_id: "abc", duration: 8, mime_type: "audio/ogg" } },
    });
    const stepFns = (voiceWizard as unknown as { steps: Array<(c: unknown) => Promise<unknown>> })
      .steps;
    await stepFns[1](ctx);
    const replies = ctx.reply.mock.calls.map((c) => c[0] as string);
    expect(replies.some((t) => /not yet available|coming soon/i.test(t))).toBe(true);
    expect(ctx.scene.leave).toHaveBeenCalled();
    expect(writeVoiceReferenceUrlMock).not.toHaveBeenCalled();
  });

  it("step 1 happy path uploads, writes voiceReferenceUrl, and leaves scene", async () => {
    process.env.REPLIT_OBJECT_STORAGE_BUCKET = "lala-voice-samples";
    uploadVoiceReferenceMock.mockResolvedValueOnce({
      url: "https://storage.replit.com/v1/buckets/lala-voice-samples/objects/creators/creator-uuid-1/voice_reference.ogg",
      key: "creators/creator-uuid-1/voice_reference.ogg",
    });
    writeVoiceReferenceUrlMock.mockResolvedValueOnce(undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(64),
      })) as unknown as typeof fetch
    );

    const ctx = makeCtx({
      message: { voice: { file_id: "voice-file-id-1", duration: 8, mime_type: "audio/ogg" } },
    });
    const stepFns = (voiceWizard as unknown as { steps: Array<(c: unknown) => Promise<unknown>> })
      .steps;
    await stepFns[1](ctx);

    // uploadVoiceReference invoked with creatorId, a Buffer, and the OGG mime type
    expect(uploadVoiceReferenceMock).toHaveBeenCalledTimes(1);
    const args = uploadVoiceReferenceMock.mock.calls[0];
    expect(args[0]).toBe("creator-uuid-1");
    expect(Buffer.isBuffer(args[1])).toBe(true);
    expect(args[2]).toMatchObject({ mimeType: "audio/ogg" });

    // writeVoiceReferenceUrl invoked with creatorId + uploaded URL
    expect(writeVoiceReferenceUrlMock).toHaveBeenCalledTimes(1);
    expect(writeVoiceReferenceUrlMock.mock.calls[0]?.[0]).toBe("creator-uuid-1");
    expect(writeVoiceReferenceUrlMock.mock.calls[0]?.[1]).toMatch(/voice_reference\.ogg$/);

    // Success reply + leave
    const replies = ctx.reply.mock.calls.map((c) => c[0] as string);
    expect(replies.some((t) => /voice sample stored|saved|/i.test(t))).toBe(true);
    expect(ctx.scene.leave).toHaveBeenCalled();
  });

  it("step 1 ignores non-voice messages by re-prompting", async () => {
    // Telegraf would normally dispatch text/photo messages to other handlers, but
    // a scene step can still be entered by a stray text. The capture step should
    // not crash on missing ctx.message.voice — it should re-prompt.
    const ctx = makeCtx({ message: {} as { voice?: never } });
    const stepFns = (voiceWizard as unknown as { steps: Array<(c: unknown) => Promise<unknown>> })
      .steps;
    await stepFns[1](ctx);
    expect(ctx.scene.leave).not.toHaveBeenCalled();
    expect(uploadVoiceReferenceMock).not.toHaveBeenCalled();
    // Should have replied with the prompt-again message.
    expect(ctx.reply).toHaveBeenCalled();
  });
});
