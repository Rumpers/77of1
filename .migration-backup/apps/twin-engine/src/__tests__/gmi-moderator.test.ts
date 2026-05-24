import { describe, it, expect, vi, beforeEach } from "vitest";
import { GmiModeratorProvider } from "../providers/gmi-moderator.js";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function mockGmiResponse(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response);
}

function chatResponse(classification: unknown) {
  return {
    choices: [{ message: { content: JSON.stringify(classification) } }],
  };
}

describe("GmiModeratorProvider", () => {
  let provider: GmiModeratorProvider;

  beforeEach(() => {
    provider = new GmiModeratorProvider(
      "https://gmi.example.com/v1",
      "test-key",
      "gpt-4o-mini"
    );
    fetchMock.mockClear();
  });

  it("passes safe content", async () => {
    mockGmiResponse(chatResponse({ passed: true, flaggedCategories: [], confidence: 0.05 }));
    const result = await provider.moderate("Hello, how are you?", "en");
    expect(result.passed).toBe(true);
    expect(result.flaggedCategories).toEqual([]);
    expect(result.confidence).toBe(0.05);
  });

  it("blocks harmful content", async () => {
    mockGmiResponse(
      chatResponse({ passed: false, flaggedCategories: ["harassment"], confidence: 0.92 })
    );
    const result = await provider.moderate("offensive text", "en");
    expect(result.passed).toBe(false);
    expect(result.flaggedCategories).toContain("harassment");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("re-derives passed=false when confidence >= 0.5 even if LLM says passed=true", async () => {
    mockGmiResponse(
      chatResponse({ passed: true, flaggedCategories: [], confidence: 0.7 })
    );
    const result = await provider.moderate("borderline text", "en");
    expect(result.passed).toBe(false);
  });

  it("re-derives passed=false when flaggedCategories non-empty even if confidence < 0.5", async () => {
    mockGmiResponse(
      chatResponse({ passed: true, flaggedCategories: ["spam"], confidence: 0.3 })
    );
    const result = await provider.moderate("spam text", "en");
    expect(result.passed).toBe(false);
  });

  it("clamps confidence to [0, 1]", async () => {
    mockGmiResponse(chatResponse({ passed: true, flaggedCategories: [], confidence: -0.5 }));
    const result = await provider.moderate("test", "en");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("filters unknown categories not in the allowlist", async () => {
    mockGmiResponse(
      chatResponse({
        passed: false,
        flaggedCategories: ["harassment", "unknown_xyz"],
        confidence: 0.8,
      })
    );
    const result = await provider.moderate("text", "en");
    expect(result.flaggedCategories).toContain("harassment");
    expect(result.flaggedCategories).not.toContain("unknown_xyz");
  });

  it("handles all supported languages and includes language in user message", async () => {
    for (const language of ["en", "ja", "zh-TW"] as const) {
      mockGmiResponse(chatResponse({ passed: true, flaggedCategories: [], confidence: 0.1 }));
      await provider.moderate("test content", language);
      const callArgs = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      const options = callArgs[1] as { body: string };
      const parsed = JSON.parse(options.body) as { messages: Array<{ content: string }> };
      expect(parsed.messages[1].content).toContain(`Language: ${language}`);
    }
  });

  it("throws on non-OK response", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    } as unknown as Response);
    await expect(provider.moderate("text", "en")).rejects.toThrow("429");
  });

  it("sends to correct endpoint with correct auth", async () => {
    mockGmiResponse(chatResponse({ passed: true, flaggedCategories: [], confidence: 0.0 }));
    await provider.moderate("test", "en");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://gmi.example.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
  });

  it("uses temperature=0 and json_object response format", async () => {
    mockGmiResponse(chatResponse({ passed: true, flaggedCategories: [], confidence: 0.0 }));
    await provider.moderate("test", "en");
    const options = (fetchMock.mock.calls[0][1] as { body: string });
    const body = JSON.parse(options.body) as { temperature: number; response_format: unknown };
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: "json_object" });
  });
});
