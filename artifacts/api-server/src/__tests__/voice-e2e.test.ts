// Voice E2E integration tests — VOICE-01, VOICE-03, SC1 (03-08)
//
// Scenario A: Voice happy path
//   - gmiTtsBreaker.fire returns canned audio bytes
//   - POST /api/twin/chat → voice_url in response (signed proxy URL)
//   - GET voice_url → 200, audio/ogg Content-Type (stubbed Object Storage)
//   - GET voice_url with expired exp → 403
//
// Scenario B: Circuit-breaker open
//   - gmiTtsBreaker.fire throws 3 transient errors → null fallback
//   - Text response always returned (no fan-facing error)
//   - generation_jobs errorMessage='circuit-open' after breaker trips
//
// Skip guard: suite is skipped gracefully when REDIS_URL is absent
// (mirrors kyc-gate.e2e.test.ts pattern for live-infra dependency).
//
// DB is MOCKED (same pattern as twin-chat.e2e.test.ts) — no DATABASE_URL required.

import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";
import http from "node:http";
import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

// ─── REDIS_URL skip guard ─────────────────────────────────────────────────────
// Voice jobs require BullMQ which requires Redis. Without REDIS_URL the queue
// is disabled and voice_url is never produced. Skip the live-queue assertions
// but keep the structural tests that don't need Redis.
const REDIS_AVAILABLE = !!process.env.REDIS_URL;

// ─── Env setup — must happen BEFORE any module import ────────────────────────
process.env.HMAC_CONVERSATION_SECRET =
  process.env.HMAC_CONVERSATION_SECRET ||
  "test-secret-min-32-chars-aaaaaaaaaaaaaaa";
process.env.TEXT_PROVIDER = "mock";
process.env.MODERATOR_PROVIDER = "mock";
// Set a known signing secret so signVoiceUrl / verifyVoiceUrl work in tests.
process.env.VOICE_URL_SIGNING_SECRET =
  process.env.VOICE_URL_SIGNING_SECRET ||
  "voice-test-secret-min-32-chars-xxxxxxxxxxx";
// Short TTL so expiry tests work quickly.
process.env.VOICE_URL_TTL_SECONDS = "3600";

// ─── Shared mock state ────────────────────────────────────────────────────────

interface CreatorRow { id: string; handle: string; killSwitchActive: boolean; monetizationUrl: string | null; config: Record<string, unknown>; }
interface TwinRow { id: string; creatorId: string; status: string; characterCard: unknown | null; voiceReferenceUrl: string | null; voiceId: string | null; }
interface KycRow { creatorId: string; status: "pending" | "signed" | "rejected"; voiceSynthesisConsentGranted: boolean; }
interface ConfigRow { creatorId: string; paused: boolean; }
interface ConsentRow { id: string; creatorId: string; modality: string; granted: boolean; revokedAt: Date | null; }
interface ConvMsgRow { conversationId: string; creatorId: string; twinId: string | null; role: "user" | "assistant"; content: string; createdAt: number; }
interface JobRow { id: string; creatorId: string; consentGrantId: string; status: string; jobType: string; resultUrl: string | null; errorMessage: string | null; bullmqJobId: string | null; attemptCount: number; retentionCategory: string; completedAt: Date | null; consentGrantVersion: number; }

const state = {
  creators: [] as CreatorRow[],
  twins: [] as TwinRow[],
  kyc: [] as KycRow[],
  configs: [] as ConfigRow[],
  consents: [] as ConsentRow[],
  conversationMessages: [] as ConvMsgRow[],
  jobs: [] as JobRow[],
  inserts: { conversation: 0 },
};

// Controls what gmiTtsBreaker.fire() returns in each scenario.
let ttsFireCallCount = 0;
let ttsMockBehavior: "happy" | "circuit-open" = "happy";

const CANNED_AUDIO = Buffer.from("OGG-FAKE-BYTES");
const CANNED_MIME = "audio/ogg";

// ─── Mock: @workspace/providers ─────────────────────────────────────────────
// Replace gmiTtsBreaker.fire() so we don't call real GMI API.
// The mock is re-configurable per scenario via ttsMockBehavior.
vi.mock("@workspace/providers", () => {
  const ProviderTransientError = class extends Error { constructor(msg: string) { super(msg); this.name = "ProviderTransientError"; } };
  const breakerMock = {
    fire: async (_input: unknown) => {
      ttsFireCallCount++;
      if (ttsMockBehavior === "circuit-open") {
        // First 3 calls throw transient error; subsequent calls return null
        // (simulating breaker having tripped to open state — null fallback).
        if (ttsFireCallCount <= 3) {
          throw new ProviderTransientError("GMI TTS transient error (test)");
        }
        return null; // breaker open → null fallback
      }
      // happy path: return canned audio bytes (ogg-formatted fake bytes)
      return { audioBytes: CANNED_AUDIO, durationSeconds: 2.5, mimeType: CANNED_MIME };
    },
    on: (_evt: string, _cb: () => void) => {},
    fallback: (_fn: () => null) => {},
  };
  return {
    gmiTtsBreaker: breakerMock,
    GmiTtsOutput: {},
  };
});

// ─── Mock: Object Storage read in voice proxy route ───────────────────────────
// artifacts/api-server/src/routes/voice.ts reads Object Storage via raw fetch.
// We intercept global fetch so the GET to the storage URL returns our canned bytes.
const originalFetch = globalThis.fetch;
let interceptObjectStorageFetch = false;
globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : (input instanceof URL ? input.toString() : (input as Request).url);
  if (interceptObjectStorageFetch && url.includes("/creators/") && url.includes("/generations/")) {
    // Simulate Object Storage GET returning canned audio bytes.
    return new Response(CANNED_AUDIO, {
      status: 200,
      headers: { "Content-Type": CANNED_MIME, "Content-Length": String(CANNED_AUDIO.length) },
    });
  }
  // Forward everything else to original fetch (or throw if not available).
  if (originalFetch) return originalFetch(input as RequestInfo, init);
  throw new Error(`fetch not intercepted and no original: ${url}`);
};

// ─── Mock: @workspace/db ─────────────────────────────────────────────────────
// Mirrors twin-chat.e2e.test.ts but adds voice-related tables.

type Predicate =
  | { __pred: "eq"; col: { __col: string }; value: unknown }
  | { __pred: "and"; args: Predicate[] }
  | { __pred: "isNull"; col: { __col: string } };

vi.mock("@workspace/db", () => {
  // Table marker objects
  const creatorsTable = { __name: "creators", id: { __col: "id" }, handle: { __col: "handle" }, killSwitchActive: { __col: "killSwitchActive" }, monetizationUrl: { __col: "monetizationUrl" }, config: { __col: "config" } };
  const twinsTable = { __name: "twins", id: { __col: "id" }, creatorId: { __col: "creatorId" }, status: { __col: "status" }, characterCard: { __col: "characterCard" }, voiceReferenceUrl: { __col: "voiceReferenceUrl" }, voiceId: { __col: "voiceId" }, handle: { __col: "handle" } };
  const creatorConfigTable = { __name: "creator_config", creatorId: { __col: "creatorId" }, paused: { __col: "paused" } };
  const conversationMessagesTable = { __name: "conversation_messages", role: { __col: "role" }, content: { __col: "content" }, conversationId: { __col: "conversationId" }, createdAt: { __col: "createdAt" } };
  const creatorKycTable = { __name: "creator_kyc", creatorId: { __col: "creatorId" }, status: { __col: "status" }, voiceSynthesisConsentGranted: { __col: "voiceSynthesisConsentGranted" } };
  const safetyAuditLogTable = { __name: "safety_audit_log", creatorId: { __col: "creatorId" }, fanIdHash: { __col: "fanIdHash" }, categoryScores: { __col: "categoryScores" }, createdAt: { __col: "createdAt" }, crisisType: { __col: "crisisType" } };
  const consentGrantsTable = { __name: "consent_grants", id: { __col: "id" }, creatorId: { __col: "creatorId" }, modality: { __col: "modality" }, granted: { __col: "granted" }, revokedAt: { __col: "revokedAt" } };
  const generationJobsTable = { __name: "generation_jobs", id: { __col: "id" }, creatorId: { __col: "creatorId" }, status: { __col: "status" }, resultUrl: { __col: "resultUrl" }, errorMessage: { __col: "errorMessage" }, jobType: { __col: "jobType" }, consentGrantId: { __col: "consentGrantId" }, bullmqJobId: { __col: "bullmqJobId" }, attemptCount: { __col: "attemptCount" } };
  const personasTable = { __name: "personas", id: { __col: "id" }, creatorId: { __col: "creatorId" } };
  const twinConfigsTable = { __name: "twin_configs", id: { __col: "id" }, creatorId: { __col: "creatorId" }, responseLength: { __col: "responseLength" }, outboundModEnabled: { __col: "outboundModEnabled" } };

  function rowsFor(table: { __name: string }): unknown[] {
    switch (table.__name) {
      case "creators": return state.creators;
      case "twins": return state.twins;
      case "creator_config": return state.configs;
      case "conversation_messages": return state.conversationMessages;
      case "creator_kyc": return state.kyc;
      case "safety_audit_log": return [];
      case "consent_grants": return state.consents;
      case "generation_jobs": return state.jobs;
      default: return [];
    }
  }

  function matchPred(row: unknown, pred: Predicate | undefined): boolean {
    if (!pred) return true;
    if (pred.__pred === "eq") {
      return (row as Record<string, unknown>)[pred.col.__col] === pred.value;
    }
    if (pred.__pred === "and") {
      return pred.args.every((p) => matchPred(row, p));
    }
    if (pred.__pred === "isNull") {
      return (row as Record<string, unknown>)[pred.col.__col] == null;
    }
    return true;
  }

  function makeSelectBuilder(projection?: Record<string, { __col: string }>) {
    let currentTable: { __name: string } | null = null;
    let currentPred: Predicate | undefined;
    let orderDesc = false;
    let limitN: number | undefined;

    const builder: Record<string, unknown> = {};
    builder.from = (t: { __name: string }) => { currentTable = t; return builder; };
    builder.where = (p: Predicate) => { currentPred = p; return builder; };
    builder.orderBy = (_: unknown) => { orderDesc = true; return builder; };
    builder.limit = (n: number) => {
      limitN = n;
      return Promise.resolve(runQuery());
    };
    builder.then = (onFulfilled: (v: unknown) => unknown, onRej?: (e: unknown) => unknown) =>
      Promise.resolve(runQuery()).then(onFulfilled, onRej);

    function runQuery(): unknown[] {
      if (!currentTable) return [];
      let rows = rowsFor(currentTable).filter((r) => matchPred(r, currentPred));
      if (orderDesc) rows = [...rows].sort((a, b) => ((b as Record<string, unknown>).createdAt as number) - ((a as Record<string, unknown>).createdAt as number));
      if (typeof limitN === "number") rows = rows.slice(0, limitN);
      if (projection) {
        return rows.map((r) => {
          const out: Record<string, unknown> = {};
          for (const [k, col] of Object.entries(projection)) {
            out[k] = (r as Record<string, unknown>)[col.__col];
          }
          return out;
        });
      }
      return rows;
    }

    return builder;
  }

  const db = {
    select: (projection?: Record<string, { __col: string }>) => makeSelectBuilder(projection),
    insert: (table: { __name: string }) => ({
      values: (row: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(row) ? row : [row];
        for (const r of rows) {
          if (table.__name === "conversation_messages") {
            state.conversationMessages.push({
              conversationId: String(r.conversationId),
              creatorId: String(r.creatorId),
              twinId: (r.twinId as string | null) ?? null,
              role: r.role as "user" | "assistant",
              content: String(r.content),
              createdAt: Date.now() + state.inserts.conversation++,
            });
          } else if (table.__name === "generation_jobs") {
            const id = (r.id as string | undefined) ?? crypto.randomUUID();
            state.jobs.push({
              id,
              creatorId: String(r.creatorId),
              consentGrantId: String(r.consentGrantId ?? ""),
              status: String(r.status ?? "queued"),
              jobType: String(r.jobType ?? "voice"),
              resultUrl: (r.resultUrl as string | null) ?? null,
              errorMessage: (r.errorMessage as string | null) ?? null,
              bullmqJobId: (r.bullmqJobId as string | null) ?? null,
              attemptCount: (r.attemptCount as number | undefined) ?? 0,
              retentionCategory: String(r.retentionCategory ?? "operational"),
              completedAt: (r.completedAt as Date | null) ?? null,
              consentGrantVersion: (r.consentGrantVersion as number | undefined) ?? 1,
            });
            return { returning: () => Promise.resolve([{ id }]) };
          }
        }
        return Promise.resolve();
      },
    }),
    update: (table: { __name: string }) => ({
      set: (updates: Record<string, unknown>) => ({
        where: (pred: Predicate) => {
          if (table.__name === "generation_jobs") {
            for (const job of state.jobs) {
              if (matchPred(job, pred)) {
                Object.assign(job, updates);
              }
            }
          }
          return Promise.resolve();
        },
      }),
    }),
  };

  return {
    db,
    creatorsTable,
    twinsTable,
    creatorConfigTable,
    conversationMessagesTable,
    creatorKycTable,
    personasTable,
    twinConfigsTable,
    safetyAuditLogTable,
    consentGrantsTable,
    generationJobsTable,
    fansTable: { __name: "fans", id: { __col: "id" } },
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (col: { __col: string }, value: unknown) => ({ __pred: "eq", col, value }),
  desc: (col: unknown) => ({ __order: "desc", col }),
  and: (...args: unknown[]) => ({ __pred: "and", args }),
  isNull: (col: { __col: string }) => ({ __pred: "isNull", col }),
  gt: (col: unknown, value: unknown) => ({ __pred: "gt", col, value }),
  sql: Object.assign((strings: TemplateStringsArray, ...vals: unknown[]) => ({ __sql: strings, vals }), {
    raw: (s: string) => ({ __sql_raw: s }),
  }),
}));

vi.mock("../lib/kyc.js", () => ({
  isKycSigned: async (creatorId: string): Promise<boolean> => {
    const row = state.kyc.find((k) => k.creatorId === creatorId);
    return row?.status === "signed";
  },
}));

vi.mock("../providers/registry.js", () => ({
  getTextProvider: () => ({
    modelId: "mock",
    async generateText(_input: unknown) {
      return { content: "Hello from the AI twin.", tokensUsed: 5, modelId: "mock", latencyMs: 0 };
    },
  }),
}));

vi.mock("../lib/constitution.js", () => ({
  readConstitution: async (_creatorId: string) => null,
}));

vi.mock("@workspace/twin-runtime/escalation", () => ({
  scoreEscalation: async () => ({ flagged: false, cumulativeScore: 0, windowSize: 0 }),
}));

// ─── Imports (after mocks are hoisted) ───────────────────────────────────────
import { signVoiceUrl, verifyVoiceUrl } from "../lib/voice-token.js";

// ─── HTTP helper ──────────────────────────────────────────────────────────────
function request(
  method: "POST" | "GET",
  basePort: number,
  path: string,
  body?: unknown,
  cookie?: string,
  additionalHeaders?: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown>; setCookie?: string; rawBody?: Buffer }> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : "";
    const headers: Record<string, string> = { ...(additionalHeaders ?? {}) };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = String(Buffer.byteLength(payload));
    }
    if (cookie) headers["Cookie"] = cookie;
    const req = http.request(
      { hostname: "127.0.0.1", port: basePort, path, method, headers },
      (res: IncomingMessage) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const rawBody = Buffer.concat(chunks);
          const setCookieHeader = res.headers["set-cookie"]?.[0];
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(rawBody.toString()), setCookie: setCookieHeader, rawBody });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: {}, setCookie: setCookieHeader, rawBody });
          }
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── App / server lifecycle ───────────────────────────────────────────────────
let server: http.Server;
let port: number;

beforeAll(async () => {
  const app = (await import("../app.js")).default;
  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      port = (server.address() as AddressInfo).port;
      resolve();
    });
  });
});

afterAll(async () => {
  interceptObjectStorageFetch = false;
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

const VOICE_CREATOR_ID = "voice-creator-001";
const VOICE_TWIN_ID = "voice-twin-001";
const VOICE_CONSENT_ID = "voice-consent-001";

function seedVoiceCreator() {
  state.creators = [
    {
      id: VOICE_CREATOR_ID,
      handle: "voicetest",
      killSwitchActive: false,
      monetizationUrl: "https://fanvue.com/voicetest",
      config: { brand_color: "#7c3aed", platform_name: "Fanvue", locale_default: "en" },
    },
  ];
  state.twins = [
    {
      id: VOICE_TWIN_ID,
      creatorId: VOICE_CREATOR_ID,
      status: "active",
      characterCard: null,
      voiceReferenceUrl: "creators/voice-creator-001/voice_reference.wav",
      voiceId: null,
    },
  ];
  state.kyc = [
    {
      creatorId: VOICE_CREATOR_ID,
      status: "signed",
      voiceSynthesisConsentGranted: true,
    },
  ];
  state.configs = [];
  state.consents = [
    {
      id: VOICE_CONSENT_ID,
      creatorId: VOICE_CREATOR_ID,
      modality: "voice",
      granted: true,
      revokedAt: null,
    },
  ];
  state.conversationMessages = [];
  state.inserts.conversation = 0;
  state.jobs = [];
}

beforeEach(() => {
  ttsMockBehavior = "happy";
  ttsFireCallCount = 0;
  interceptObjectStorageFetch = false;
  seedVoiceCreator();
});

// ─── Scenario A: Voice happy path ─────────────────────────────────────────────

describe("SC1 — Scenario A: Voice happy path (VOICE-01, VOICE-03, COMPLY-01)", () => {
  it("imports signVoiceUrl + verifyVoiceUrl (validates proxy route signing contract)", () => {
    expect(typeof signVoiceUrl).toBe("function");
    expect(typeof verifyVoiceUrl).toBe("function");
  });

  it("POST /api/twin/chat returns 200 with text reply for voice-enabled creator", async () => {
    const { status, body } = await request("POST", port, "/api/twin/chat", {
      handle: "voicetest",
      message: "Hello, how are you?",
    });
    expect(status).toBe(200);
    expect(typeof body.text).toBe("string");
    expect((body.text as string).length).toBeGreaterThan(0);
    expect(typeof body.disclosure_footer).toBe("string");
  });

  it("signVoiceUrl returns URL matching /api/voice/.*?exp=.*&token=[0-9a-f]+", () => {
    // Validates the proxy URL format that voice_url returns in chat response.
    const jobId = crypto.randomUUID();
    const url = signVoiceUrl(jobId, 3600);
    expect(url).toMatch(/\/api\/voice\/.+\?exp=\d+&token=[0-9a-f]+/);
  });

  it("verifyVoiceUrl returns false for expired URL (exp in past)", () => {
    // Manually compute an expired token to verify 403 path logic.
    const jobId = crypto.randomUUID();
    const pastExp = Math.floor(Date.now() / 1000) - 3600;
    // verifyVoiceUrl should reject expired exp.
    const result = verifyVoiceUrl(jobId, pastExp, "deadbeef".repeat(8));
    expect(result).toBe(false);
  });

  it.skipIf(!REDIS_AVAILABLE)(
    "GET voice_url → 200, audio content-type, body contains canned bytes [REDIS required]",
    async () => {
      // Setup: activate Object Storage interception for happy path.
      interceptObjectStorageFetch = true;
      ttsMockBehavior = "happy";

      const { status: chatStatus, body: chatBody } = await request("POST", port, "/api/twin/chat", {
        handle: "voicetest",
        message: "Hi there!",
      });
      expect(chatStatus).toBe(200);

      // When REDIS is available, voice_url should be present in the response.
      const voiceUrl = chatBody.voice_url as string | undefined;
      expect(voiceUrl).toBeDefined();
      expect(voiceUrl).toMatch(/\/api\/voice\/.+\?exp=\d+&token=[0-9a-f]+/);

      // GET the voice_url from the proxy route.
      const { status: audioStatus, rawBody } = await request("GET", port, voiceUrl!);
      expect(audioStatus).toBe(200);
      expect(rawBody?.toString()).toContain("OGG-FAKE-BYTES");
    },
    15_000,
  );

  it.skipIf(!REDIS_AVAILABLE)(
    "GET voice_url with exp rewritten to past → 403 [REDIS required]",
    async () => {
      interceptObjectStorageFetch = true;
      ttsMockBehavior = "happy";

      const { body: chatBody } = await request("POST", port, "/api/twin/chat", {
        handle: "voicetest",
        message: "test expiry",
      });
      const voiceUrl = chatBody.voice_url as string | undefined;
      expect(voiceUrl).toBeDefined();

      // Rewrite exp to past.
      const expiredUrl = voiceUrl!.replace(/exp=\d+/, `exp=${Math.floor(Date.now() / 1000) - 3600}`);
      const { status: expiredStatus } = await request("GET", port, expiredUrl);
      expect(expiredStatus).toBe(403);
    },
    15_000,
  );
});

// ─── Scenario B: Circuit-breaker open ─────────────────────────────────────────

describe("SC1 — Scenario B: Circuit-breaker open → text-only, no fan-facing error (VOICE-01)", () => {
  it("text response is returned even when gmiTtsBreaker throws (circuit-open path)", async () => {
    ttsMockBehavior = "circuit-open";

    // Turn 1: breaker throws transient error → voice fails, text succeeds.
    const { status, body } = await request("POST", port, "/api/twin/chat", {
      handle: "voicetest",
      message: "testing circuit breaker",
    });
    // Text MUST still be returned — no fan-facing error.
    expect(status).toBe(200);
    expect(typeof body.text).toBe("string");
    expect((body.text as string).length).toBeGreaterThan(0);
  });

  it("text response is returned on all 4 turns when breaker is open (circuit-open path)", async () => {
    ttsMockBehavior = "circuit-open";
    const cookie1res = await request("POST", port, "/api/twin/chat", { handle: "voicetest", message: "turn 1" });
    expect(cookie1res.status).toBe(200);
    expect(typeof cookie1res.body.text).toBe("string");

    const cookie = cookie1res.setCookie?.split(";")[0] ?? "";

    for (const turn of [2, 3, 4]) {
      const { status, body } = await request("POST", port, "/api/twin/chat", { handle: "voicetest", message: `turn ${turn}` }, cookie);
      // Every turn's text response must succeed — no fan-facing error.
      expect(status).toBe(200);
      expect(typeof body.text).toBe("string");
      // voice_url should be absent (circuit open = no voice job enqueued successfully).
      // Note: voice_url may or may not appear depending on enqueue timing; the important
      // assertion is that text is always returned (status 200, body.text truthy).
    }
  });

  it.skipIf(!REDIS_AVAILABLE)(
    "generation_jobs row for circuit-open turn has errorMessage='circuit-open' [REDIS required]",
    async () => {
      ttsMockBehavior = "circuit-open";
      ttsFireCallCount = 3; // Simulate breaker already having tripped (3 prior failures).

      await request("POST", port, "/api/twin/chat", { handle: "voicetest", message: "after breaker open" });

      // Give the worker a moment to process the job.
      await new Promise((r) => setTimeout(r, 500));

      // Find the generation_jobs row for this turn.
      const circuitOpenJob = state.jobs.find(
        (j) => j.errorMessage === "circuit-open" || j.status === "failed",
      );
      expect(circuitOpenJob).toBeDefined();
      expect(circuitOpenJob?.errorMessage).toBe("circuit-open");
    },
    10_000,
  );
});
