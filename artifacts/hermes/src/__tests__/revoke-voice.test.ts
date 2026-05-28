// GREEN tests for plan 02-08 — /revoke_voice command + helpers (ONBOARD-03).
//
// The /revoke_voice command body itself lives in index.ts (Telegraf binding),
// so this suite targets the underlying helpers + the orchestration logic
// extracted into hermes/revoke-voice.ts.
//
// Covers:
//   - happy path: active grant found → markVoiceConsentRevoked + clearVoiceReferenceUrl
//     + enqueueRevocation called with the correct payload
//   - no-active-grant path: returns ok=false with reason "no_active_grant"
//   - Redis-unavailable path: revocation still completes (DB sweep is the
//     authoritative path per api-server/routes/consent.ts pattern); returns
//     queued=false
//   - SLA logging: elapsed time captured and warned if >2s (mirrors setPaused SLA)

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  creatorsTable: {},
  creatorConfigTable: {},
  creatorKycTable: {},
  creatorTotpTable: {},
  twinsTable: {},
  consentGrantsTable: {},
}));

// hermes/db.ts is partially mocked — we replace the three revocation writers
// the orchestration calls.
const findActiveVoiceConsentGrantMock = vi.fn();
const markVoiceConsentRevokedMock = vi.fn();
const clearVoiceReferenceUrlMock = vi.fn();

vi.mock("../db.js", () => ({
  findActiveVoiceConsentGrant: findActiveVoiceConsentGrantMock,
  markVoiceConsentRevoked: markVoiceConsentRevokedMock,
  clearVoiceReferenceUrl: clearVoiceReferenceUrlMock,
  // Keep the other db.ts exports inert so co-imports don't crash.
  findCreatorByTelegramId: vi.fn(),
  getCreatorStats: vi.fn(),
  setPaused: vi.fn(),
  getKycRow: vi.fn(),
  upsertTwinCharacterCard: vi.fn(),
  writeMonetization: vi.fn(),
  writeVoiceReferenceUrl: vi.fn(),
}));

// Mock bullmq's Queue at module load. The enqueueRevocation helper dynamically
// imports bullmq (api-server pattern) so we mock the named export.
const queueAddMock = vi.fn();
const queueCloseMock = vi.fn();
const QueueCtorMock = vi.fn(() => ({
  add: queueAddMock,
  close: queueCloseMock,
}));
vi.mock("bullmq", () => ({
  Queue: QueueCtorMock,
}));

const { revokeVoice } = await import("../revoke-voice.js");

beforeEach(() => {
  findActiveVoiceConsentGrantMock.mockReset();
  markVoiceConsentRevokedMock.mockReset();
  clearVoiceReferenceUrlMock.mockReset();
  queueAddMock.mockReset();
  queueCloseMock.mockReset();
  QueueCtorMock.mockClear();
  delete process.env.REDIS_URL;
});

describe("revokeVoice orchestration", () => {
  it("returns ok=false reason='no_active_grant' when no voice grant exists", async () => {
    findActiveVoiceConsentGrantMock.mockResolvedValueOnce(null);
    const result = await revokeVoice("creator-uuid-1");
    expect(result).toMatchObject({ ok: false, reason: "no_active_grant" });
    expect(markVoiceConsentRevokedMock).not.toHaveBeenCalled();
    expect(clearVoiceReferenceUrlMock).not.toHaveBeenCalled();
    expect(QueueCtorMock).not.toHaveBeenCalled();
  });

  it("revokes the grant, clears the URL, and enqueues when Redis is available", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    findActiveVoiceConsentGrantMock.mockResolvedValueOnce({ id: "grant-uuid-1" });
    markVoiceConsentRevokedMock.mockResolvedValueOnce({ elapsed: 5 });
    clearVoiceReferenceUrlMock.mockResolvedValueOnce(undefined);
    queueAddMock.mockResolvedValueOnce(undefined);
    queueCloseMock.mockResolvedValueOnce(undefined);

    const result = await revokeVoice("creator-uuid-1");

    expect(result).toMatchObject({
      ok: true,
      consentGrantId: "grant-uuid-1",
      queued: true,
    });
    expect(typeof result.elapsedMs).toBe("number");

    expect(markVoiceConsentRevokedMock).toHaveBeenCalledWith("grant-uuid-1");
    expect(clearVoiceReferenceUrlMock).toHaveBeenCalledWith("creator-uuid-1");
    expect(QueueCtorMock).toHaveBeenCalledTimes(1);
    expect(queueAddMock).toHaveBeenCalledTimes(1);

    // Payload shape: { type, creatorId, consentGrantId, modality: "voice", killSwitch: false }
    const [jobName, payload, opts] = queueAddMock.mock.calls[0] ?? [];
    expect(jobName).toBe("revoke");
    expect(payload).toMatchObject({
      type: "consent-revocation",
      creatorId: "creator-uuid-1",
      consentGrantId: "grant-uuid-1",
      modality: "voice",
      killSwitch: false,
    });
    // Priority 1 + dedupe jobId so re-invocations are idempotent
    expect(opts).toMatchObject({ priority: 1 });
    expect((opts as { jobId?: string }).jobId).toMatch(/grant-uuid-1/);
  });

  it("returns queued=false when REDIS_URL is unset (DB sweep is authoritative)", async () => {
    findActiveVoiceConsentGrantMock.mockResolvedValueOnce({ id: "grant-uuid-2" });
    markVoiceConsentRevokedMock.mockResolvedValueOnce({ elapsed: 8 });
    clearVoiceReferenceUrlMock.mockResolvedValueOnce(undefined);

    const result = await revokeVoice("creator-uuid-1");

    expect(result).toMatchObject({
      ok: true,
      consentGrantId: "grant-uuid-2",
      queued: false,
    });
    expect(QueueCtorMock).not.toHaveBeenCalled();
    // DB write still ran
    expect(markVoiceConsentRevokedMock).toHaveBeenCalled();
    expect(clearVoiceReferenceUrlMock).toHaveBeenCalled();
  });

  it("returns queued=false when bullmq Queue.add throws (e.g. Redis unreachable)", async () => {
    process.env.REDIS_URL = "redis://broken:6379";
    findActiveVoiceConsentGrantMock.mockResolvedValueOnce({ id: "grant-uuid-3" });
    markVoiceConsentRevokedMock.mockResolvedValueOnce({ elapsed: 4 });
    clearVoiceReferenceUrlMock.mockResolvedValueOnce(undefined);
    queueAddMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    queueCloseMock.mockResolvedValueOnce(undefined);

    const result = await revokeVoice("creator-uuid-1");

    // DB write succeeded; enqueue failed → ok=true but queued=false
    expect(result.ok).toBe(true);
    expect(result.queued).toBe(false);
    expect(result.consentGrantId).toBe("grant-uuid-3");
  });

  it("records elapsedMs >= the db-write elapsed and warns when >2000ms", async () => {
    findActiveVoiceConsentGrantMock.mockResolvedValueOnce({ id: "grant-uuid-4" });
    // Simulate a slow DB write (>2s SLA threshold)
    markVoiceConsentRevokedMock.mockResolvedValueOnce({ elapsed: 2500 });
    clearVoiceReferenceUrlMock.mockResolvedValueOnce(undefined);

    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await revokeVoice("creator-uuid-1");

    expect(result.ok).toBe(true);
    expect(result.dbWriteMs).toBe(2500);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(2500);
    // A WARN line must be emitted by the orchestration when db_write_ms exceeds 2s
    const warned = errSpy.mock.calls.some((args) =>
      String(args[0] ?? "").includes("WARN"),
    );
    expect(warned).toBe(true);
    errSpy.mockRestore();
  });
});
