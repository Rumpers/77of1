// Tests for HID-059: asset upload content moderation gate.
// Strategy: mock the GMI fetch call; verify pass/block logic and audit writes.

import { describe, it, expect, vi, beforeEach, type MockedFunction } from "vitest";
import { GmiAssetModerator } from "../providers/gmi/GmiAssetModerator.js";

// Minimal GMI response factory
function gmiResp(body: string) {
  return Promise.resolve(
    new Response(
      JSON.stringify({ choices: [{ message: { content: body } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
}

function makeBuffer(size = 100): Buffer {
  return Buffer.alloc(size, 0);
}

describe("GmiAssetModerator", () => {
  let moderator: GmiAssetModerator;
  let fetchMock: MockedFunction<typeof fetch>;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    fetchMock = fetch as MockedFunction<typeof fetch>;

    moderator = new GmiAssetModerator({
      baseUrl: "https://gmi.test/v1",
      apiKey: "test-key",
      model: "gpt-4o-mini",
    });
  });

  it("returns passed=true for safe content", async () => {
    fetchMock.mockReturnValueOnce(
      gmiResp('{"passed":true,"flaggedCategories":[],"confidence":0.05}'),
    );

    const result = await moderator.moderateImage(makeBuffer(), "image/jpeg");
    expect(result.passed).toBe(true);
    expect(result.flaggedCategories).toHaveLength(0);
    expect(result.confidence).toBeCloseTo(0.05);
    expect(result.provider).toBe("gmi");
    expect(result.fileSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("blocks csam with confidence 1.0", async () => {
    fetchMock.mockReturnValueOnce(
      gmiResp('{"passed":false,"flaggedCategories":["csam"],"confidence":1.0}'),
    );

    const result = await moderator.moderateImage(makeBuffer(), "image/jpeg");
    expect(result.passed).toBe(false);
    expect(result.flaggedCategories).toContain("csam");
    expect(result.confidence).toBe(1.0);
  });

  it("re-derives passed=false when LLM says passed=true but confidence >= 0.5", async () => {
    // LLM inconsistency guard: passed must be false if confidence >= 0.5
    fetchMock.mockReturnValueOnce(
      gmiResp('{"passed":true,"flaggedCategories":[],"confidence":0.7}'),
    );

    const result = await moderator.moderateImage(makeBuffer(), "image/jpeg");
    expect(result.passed).toBe(false);
    expect(result.confidence).toBe(0.7);
  });

  it("re-derives passed=false when LLM says passed=true but flaggedCategories is non-empty", async () => {
    fetchMock.mockReturnValueOnce(
      gmiResp('{"passed":true,"flaggedCategories":["violence"],"confidence":0.2}'),
    );

    const result = await moderator.moderateImage(makeBuffer(), "image/jpeg");
    expect(result.passed).toBe(false);
    expect(result.flaggedCategories).toContain("violence");
  });

  it("strips unknown categories from flaggedCategories", async () => {
    fetchMock.mockReturnValueOnce(
      gmiResp('{"passed":false,"flaggedCategories":["violence","unknown_cat","future_cat"],"confidence":0.9}'),
    );

    const result = await moderator.moderateImage(makeBuffer(), "image/jpeg");
    expect(result.flaggedCategories).toContain("violence");
    expect(result.flaggedCategories).not.toContain("unknown_cat");
    expect(result.flaggedCategories).not.toContain("future_cat");
  });

  it("clamps confidence to [0,1]", async () => {
    fetchMock.mockReturnValueOnce(
      gmiResp('{"passed":false,"flaggedCategories":["csam"],"confidence":1.5}'),
    );

    const result = await moderator.moderateImage(makeBuffer(), "image/jpeg");
    expect(result.confidence).toBe(1.0);
  });

  it("defaults to failed-closed when confidence is missing", async () => {
    // Missing confidence → default 0.5 → passed=false (0.5 is not < 0.5)
    fetchMock.mockReturnValueOnce(
      gmiResp('{"passed":true,"flaggedCategories":[]}'),
    );

    const result = await moderator.moderateImage(makeBuffer(), "image/jpeg");
    expect(result.passed).toBe(false);
    expect(result.confidence).toBe(0.5);
  });

  it("throws a clear error when GMI returns a non-2xx status", async () => {
    fetchMock.mockReturnValueOnce(
      Promise.resolve(new Response("Internal Server Error", { status: 500 })),
    );

    await expect(
      moderator.moderateImage(makeBuffer(), "image/jpeg"),
    ).rejects.toThrow("GMI API error 500");
  });

  it("throws on network failure", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));

    await expect(
      moderator.moderateImage(makeBuffer(), "image/jpeg"),
    ).rejects.toThrow("GMI network error");
  });

  describe("moderateVideoThumbnail", () => {
    it("returns metadata-only pass when no thumbnail is available", async () => {
      const videoBytes = makeBuffer(1000);
      const result = await moderator.moderateVideoThumbnail(null, videoBytes);

      expect(result.passed).toBe(true);
      expect(result.provider).toBe("metadata_only");
      expect(result.latencyMs).toBe(0);
      expect(result.flaggedCategories).toHaveLength(0);
      // fileSha256 must be hash of videoBytes, not thumbnail
      expect(result.fileSha256).toMatch(/^[0-9a-f]{64}$/);
      // fetch must NOT have been called (no GMI call for metadata-only)
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("moderates via thumbnail when bytes are provided", async () => {
      fetchMock.mockReturnValueOnce(
        gmiResp('{"passed":true,"flaggedCategories":[],"confidence":0.1}'),
      );

      const videoBytes = makeBuffer(1000);
      const thumbBytes = makeBuffer(200);
      const result = await moderator.moderateVideoThumbnail(thumbBytes, videoBytes);

      expect(result.passed).toBe(true);
      expect(result.provider).toBe("gmi");
      // fileSha256 must be hash of videoBytes (not thumbnail)
      const expected = require("crypto").createHash("sha256").update(videoBytes).digest("hex");
      expect(result.fileSha256).toBe(expected);
    });

    it("blocks video when thumbnail reveals harmful content", async () => {
      fetchMock.mockReturnValueOnce(
        gmiResp('{"passed":false,"flaggedCategories":["csam"],"confidence":1.0}'),
      );

      const videoBytes = makeBuffer(1000);
      const thumbBytes = makeBuffer(200);
      const result = await moderator.moderateVideoThumbnail(thumbBytes, videoBytes);

      expect(result.passed).toBe(false);
      expect(result.flaggedCategories).toContain("csam");
    });
  });
});

describe("GmiAssetModerator constructor", () => {
  it("throws when GMI_API_KEY is not set", () => {
    const originalEnv = process.env["GMI_API_KEY"];
    delete process.env["GMI_API_KEY"];

    expect(() => new GmiAssetModerator()).toThrow("GMI_API_KEY not set");

    if (originalEnv !== undefined) process.env["GMI_API_KEY"] = originalEnv;
  });
});
