// Unit tests for OpenAiModeratorProvider — PATTERNS S3 contract.
// Verifies env-var construction, fetch shape, error taxonomy, response parsing.
// No real OpenAI call — global fetch is stubbed.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { OpenAiModeratorProvider } from "../providers/openai/OpenAiModeratorProvider.js";
import { MockModeratorProvider } from "../providers/openai/MockModeratorProvider.js";
import {
  ProviderError,
  ProviderTransientError,
} from "../providers/interfaces.js";

beforeEach(() => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.HELICONE_API_KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OpenAiModeratorProvider — construction", () => {
  it("throws when OPENAI_API_KEY missing and no apiKey passed", () => {
    expect(() => new OpenAiModeratorProvider()).toThrow(
      /OPENAI_API_KEY is required/,
    );
  });

  it("accepts explicit apiKey option", () => {
    const p = new OpenAiModeratorProvider({ apiKey: "sk-test" });
    expect(p.modelId).toBe("omni-moderation-latest");
  });

  it("reads OPENAI_API_KEY from process.env", () => {
    process.env.OPENAI_API_KEY = "sk-from-env";
    const p = new OpenAiModeratorProvider();
    expect(p.modelId).toBe("omni-moderation-latest");
  });
});

describe("OpenAiModeratorProvider — moderate()", () => {
  it("returns flagged=false for benign input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: "mod-1",
          model: "omni-moderation-latest",
          results: [
            {
              flagged: false,
              categories: { "self-harm": false, sexual: false },
              category_scores: { "self-harm": 0.001, sexual: 0.002 },
            },
          ],
        }),
      } as Response),
    );

    const p = new OpenAiModeratorProvider({ apiKey: "sk-test" });
    const out = await p.moderate("benign hello");

    expect(out.flagged).toBe(false);
    expect(out.categories).toEqual([]);
    expect(out.primaryCategory).toBeNull();
  });

  it("returns flagged=true with categories + primaryCategory for self-harm", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          id: "mod-2",
          model: "omni-moderation-latest",
          results: [
            {
              flagged: true,
              categories: {
                "self-harm": true,
                "self-harm/intent": true,
                sexual: false,
              },
              category_scores: {
                "self-harm": 0.91,
                "self-harm/intent": 0.85,
                sexual: 0.01,
              },
            },
          ],
        }),
      } as Response),
    );

    const p = new OpenAiModeratorProvider({ apiKey: "sk-test" });
    const out = await p.moderate("I want to hurt myself");

    expect(out.flagged).toBe(true);
    expect(out.categories).toContain("self-harm");
    expect(out.categories).toContain("self-harm/intent");
    expect(out.primaryCategory).toBe("self-harm"); // highest score 0.91
    expect(out.scores["self-harm"]).toBe(0.91);
  });

  it("POSTs to /moderations with model + input + Bearer header", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          {
            flagged: false,
            categories: {},
            category_scores: {},
          },
        ],
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    const p = new OpenAiModeratorProvider({ apiKey: "sk-test-key" });
    await p.moderate("hello");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://api.openai.com/v1/moderations");
    expect((init as RequestInit).method).toBe("POST");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer sk-test-key");
    expect(headers["Content-Type"]).toBe("application/json");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("omni-moderation-latest");
    expect(body.input).toBe("hello");
  });

  it("routes through Helicone when HELICONE_API_KEY is set", async () => {
    process.env.HELICONE_API_KEY = "sk-helicone";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        results: [{ flagged: false, categories: {}, category_scores: {} }],
      }),
    } as Response);
    vi.stubGlobal("fetch", fetchSpy);

    const p = new OpenAiModeratorProvider({ apiKey: "sk-test" });
    await p.moderate("hi");

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe("https://oai.helicone.ai/v1/moderations");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Helicone-Auth"]).toBe("Bearer sk-helicone");
  });

  it("throws ProviderTransientError on 5xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
        text: async () => "overloaded",
      } as Response),
    );

    const p = new OpenAiModeratorProvider({ apiKey: "sk-test" });
    await expect(p.moderate("hi")).rejects.toBeInstanceOf(
      ProviderTransientError,
    );
  });

  it("throws ProviderError on 4xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "bad key",
      } as Response),
    );

    const p = new OpenAiModeratorProvider({ apiKey: "sk-test" });
    await expect(p.moderate("hi")).rejects.toBeInstanceOf(ProviderError);
  });

  it("throws ProviderTransientError on network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNRESET")),
    );

    const p = new OpenAiModeratorProvider({ apiKey: "sk-test" });
    await expect(p.moderate("hi")).rejects.toBeInstanceOf(
      ProviderTransientError,
    );
  });
});

describe("MockModeratorProvider", () => {
  it("always returns flagged=false", async () => {
    const p = new MockModeratorProvider();
    const out = await p.moderate("anything including I want to hurt myself");
    expect(out.flagged).toBe(false);
    expect(out.categories).toEqual([]);
    expect(out.primaryCategory).toBeNull();
    expect(p.modelId).toBe("mock");
  });
});
