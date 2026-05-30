// RED tests for 03-07 — HMAC voice-token sign/verify primitives.
// Covers all behaviors from the plan's <behavior> block.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VALID_SECRET = "x".repeat(64); // 64-char hex ≥ 32-char minimum

let savedSecret: string | undefined;

beforeEach(() => {
  savedSecret = process.env.VOICE_URL_SIGNING_SECRET;
  process.env.VOICE_URL_SIGNING_SECRET = VALID_SECRET;
  vi.resetModules();
});

afterEach(() => {
  if (savedSecret === undefined) delete process.env.VOICE_URL_SIGNING_SECRET;
  else process.env.VOICE_URL_SIGNING_SECRET = savedSecret;
  vi.resetModules();
});

const SAMPLE_JOB_ID = "550e8400-e29b-41d4-a716-446655440000";

describe("VOICE-03: signVoiceUrl", () => {
  it("returns a string starting with the /api/voice/{jobId}?exp= path", async () => {
    const { signVoiceUrl } = await import("../lib/voice-token.js");
    const url = signVoiceUrl(SAMPLE_JOB_ID);
    expect(url).toMatch(new RegExp(`^/api/voice/${SAMPLE_JOB_ID}\\?exp=`));
  });

  it("URL contains &token= followed by 64 hex chars", async () => {
    const { signVoiceUrl } = await import("../lib/voice-token.js");
    const url = signVoiceUrl(SAMPLE_JOB_ID);
    expect(url).toMatch(/&token=[0-9a-f]{64}$/);
  });

  it("signVoiceUrl(jobId, 60) sets exp ~ now+60", async () => {
    const { signVoiceUrl } = await import("../lib/voice-token.js");
    const before = Math.floor(Date.now() / 1000);
    const url = signVoiceUrl(SAMPLE_JOB_ID, 60);
    const after = Math.floor(Date.now() / 1000);
    const match = url.match(/exp=(\d+)/);
    expect(match).not.toBeNull();
    const exp = parseInt(match![1], 10);
    expect(exp).toBeGreaterThanOrEqual(before + 59);
    expect(exp).toBeLessThanOrEqual(after + 61);
  });

  it("throws when VOICE_URL_SIGNING_SECRET is unset", async () => {
    delete process.env.VOICE_URL_SIGNING_SECRET;
    vi.resetModules();
    const { signVoiceUrl } = await import("../lib/voice-token.js");
    expect(() => signVoiceUrl(SAMPLE_JOB_ID)).toThrow(/VOICE_URL_SIGNING_SECRET/);
  });

  it("throws when VOICE_URL_SIGNING_SECRET is shorter than 32 chars", async () => {
    process.env.VOICE_URL_SIGNING_SECRET = "short";
    vi.resetModules();
    const { signVoiceUrl } = await import("../lib/voice-token.js");
    expect(() => signVoiceUrl(SAMPLE_JOB_ID)).toThrow(/VOICE_URL_SIGNING_SECRET/);
  });
});

describe("VOICE-03: verifyVoiceUrl", () => {
  it("returns true for a freshly-signed pair", async () => {
    const { signVoiceUrl, verifyVoiceUrl } = await import("../lib/voice-token.js");
    const url = signVoiceUrl(SAMPLE_JOB_ID);
    const expMatch = url.match(/exp=(\d+)/);
    const tokenMatch = url.match(/token=([0-9a-f]+)/);
    expect(expMatch).not.toBeNull();
    expect(tokenMatch).not.toBeNull();
    const exp = parseInt(expMatch![1], 10);
    const token = tokenMatch![1];
    expect(verifyVoiceUrl(SAMPLE_JOB_ID, exp, token)).toBe(true);
  });

  it("returns false for expired tokens (exp < now)", async () => {
    const { verifyVoiceUrl, signVoiceUrl } = await import("../lib/voice-token.js");
    // Sign with ttl=-1 so exp is already in the past
    const url = signVoiceUrl(SAMPLE_JOB_ID, -1);
    const expMatch = url.match(/exp=(\d+)/);
    const tokenMatch = url.match(/token=([0-9a-f]+)/);
    const exp = parseInt(expMatch![1], 10);
    const token = tokenMatch![1];
    expect(verifyVoiceUrl(SAMPLE_JOB_ID, exp, token)).toBe(false);
  });

  it("returns false for tampered token (single hex char flipped)", async () => {
    const { signVoiceUrl, verifyVoiceUrl } = await import("../lib/voice-token.js");
    const url = signVoiceUrl(SAMPLE_JOB_ID);
    const expMatch = url.match(/exp=(\d+)/);
    const tokenMatch = url.match(/token=([0-9a-f]+)/);
    const exp = parseInt(expMatch![1], 10);
    const token = tokenMatch![1];
    // Flip the last hex char
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifyVoiceUrl(SAMPLE_JOB_ID, exp, tampered)).toBe(false);
  });

  it("returns false for mismatched jobId", async () => {
    const { signVoiceUrl, verifyVoiceUrl } = await import("../lib/voice-token.js");
    const url = signVoiceUrl(SAMPLE_JOB_ID);
    const expMatch = url.match(/exp=(\d+)/);
    const tokenMatch = url.match(/token=([0-9a-f]+)/);
    const exp = parseInt(expMatch![1], 10);
    const token = tokenMatch![1];
    const differentJobId = "00000000-0000-0000-0000-000000000001";
    expect(verifyVoiceUrl(differentJobId, exp, token)).toBe(false);
  });
});
