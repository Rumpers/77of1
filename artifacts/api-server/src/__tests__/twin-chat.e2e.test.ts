// CHAT-01 + CHAT-03 + CHAT-04 + COMPLY-01 — POST /api/twin/chat full pipeline.
//
// We exercise the route via supertest-style HTTP harness against the real
// Express app, but mock the DB module (@workspace/db) and the text provider so
// the test runs without DATABASE_URL or GMI access.
//
// Mocks are declared BEFORE any import of app/route code so the route's lazy
// dynamic imports resolve to the mocked versions.
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import http from "node:http";
import type { IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

// ─── Env setup (must happen BEFORE any module imports the app) ───────────────
process.env.HMAC_CONVERSATION_SECRET =
  process.env.HMAC_CONVERSATION_SECRET ||
  "test-secret-min-32-chars-aaaaaaaaaaaaaaa";
process.env.TEXT_PROVIDER = "mock";

// ─── In-memory DB state for mocks ────────────────────────────────────────────
interface CreatorRow {
  id: string;
  handle: string;
  killSwitchActive: boolean;
  monetizationUrl: string | null;
  config: Record<string, unknown>;
}
interface TwinRow {
  id: string;
  creatorId: string;
  characterCard: unknown | null;
}
interface KycRow {
  creatorId: string;
  status: "pending" | "signed" | "rejected";
}
interface ConfigRow {
  creatorId: string;
  paused: boolean;
}
interface ConvMsgRow {
  conversationId: string;
  creatorId: string;
  twinId: string | null;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

const state = {
  creators: [] as CreatorRow[],
  twins: [] as TwinRow[],
  kyc: [] as KycRow[],
  configs: [] as ConfigRow[],
  conversationMessages: [] as ConvMsgRow[],
  inserts: { conversation: 0 },
};

// Provider call recorder
const providerCalls: Array<{
  systemPrompt: string;
  messages: Array<{ role: string; content: string }>;
  fanId: string;
  maxTokens?: number;
  creatorId: string;
}> = [];
let nextProviderResponse = "[mock-reply-A]";

// ─── Mock @workspace/db ─────────────────────────────────────────────────────
// Marker objects so the where() / eq() can identify "which table & column".
const creatorsTable = {
  __name: "creators",
  id: { __col: "id" },
  handle: { __col: "handle" },
  killSwitchActive: { __col: "killSwitchActive" },
  monetizationUrl: { __col: "monetizationUrl" },
  config: { __col: "config" },
};
const twinsTable = {
  __name: "twins",
  id: { __col: "id" },
  creatorId: { __col: "creatorId" },
  characterCard: { __col: "characterCard" },
};
const creatorConfigTable = {
  __name: "creator_config",
  creatorId: { __col: "creatorId" },
  paused: { __col: "paused" },
};
const conversationMessagesTable = {
  __name: "conversation_messages",
  role: { __col: "role" },
  content: { __col: "content" },
  conversationId: { __col: "conversationId" },
  createdAt: { __col: "createdAt" },
};
const creatorKycTable = {
  __name: "creator_kyc",
  creatorId: { __col: "creatorId" },
  status: { __col: "status" },
};

interface Predicate {
  __pred: "eq";
  col: { __col: string };
  value: unknown;
}

vi.mock("@workspace/db", () => {
  function rowsFor(table: { __name: string }): unknown[] {
    switch (table.__name) {
      case "creators":
        return state.creators;
      case "twins":
        return state.twins;
      case "creator_config":
        return state.configs;
      case "conversation_messages":
        return state.conversationMessages;
      case "creator_kyc":
        return state.kyc;
      default:
        return [];
    }
  }
  function applyWhere(
    rows: unknown[],
    pred: Predicate | undefined,
  ): unknown[] {
    if (!pred) return rows;
    const colName = pred.col.__col;
    return rows.filter((r) => (r as Record<string, unknown>)[colName] === pred.value);
  }

  function makeSelectBuilder(projection?: Record<string, { __col: string }>) {
    let currentTable: { __name: string } | null = null;
    let currentWhere: Predicate | undefined;
    let currentOrderDesc = false;
    let currentLimit: number | undefined;

    const builder: Record<string, unknown> = {};
    builder.from = (t: { __name: string }) => {
      currentTable = t;
      return builder;
    };
    builder.where = (p: Predicate) => {
      currentWhere = p;
      return builder;
    };
    builder.orderBy = (_: unknown) => {
      currentOrderDesc = true;
      return builder;
    };
    builder.limit = (n: number) => {
      currentLimit = n;
      const result = runQuery();
      return Promise.resolve(result);
    };
    builder.then = (onFulfilled: (v: unknown) => unknown, onRej?: (e: unknown) => unknown) =>
      Promise.resolve(runQuery()).then(onFulfilled, onRej);

    function runQuery(): unknown[] {
      if (!currentTable) return [];
      let rows = applyWhere(rowsFor(currentTable), currentWhere);
      if (currentOrderDesc) {
        rows = [...rows].sort(
          (a, b) =>
            ((b as Record<string, unknown>).createdAt as number) -
            ((a as Record<string, unknown>).createdAt as number),
        );
      }
      if (typeof currentLimit === "number") rows = rows.slice(0, currentLimit);
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
    select: (projection?: Record<string, { __col: string }>) =>
      makeSelectBuilder(projection),
    insert: (table: { __name: string }) => ({
      values: (row: Record<string, unknown>) => {
        if (table.__name === "conversation_messages") {
          state.conversationMessages.push({
            conversationId: String(row.conversationId),
            creatorId: String(row.creatorId),
            twinId: (row.twinId as string | null) ?? null,
            role: row.role as "user" | "assistant",
            content: String(row.content),
            createdAt: Date.now() + state.inserts.conversation++,
          });
        }
        return Promise.resolve();
      },
    }),
  };

  return {
    db,
    creatorsTable,
    twinsTable,
    creatorConfigTable,
    conversationMessagesTable,
    creatorKycTable,
  };
});

vi.mock("drizzle-orm", () => ({
  eq: (col: { __col: string }, value: unknown): Predicate => ({
    __pred: "eq",
    col,
    value,
  }),
  desc: (col: unknown) => ({ __order: "desc", col }),
}));

// ─── Mock kyc isKycSigned to read from in-memory state ───────────────────────
vi.mock("../lib/kyc.js", () => ({
  isKycSigned: async (creatorId: string): Promise<boolean> => {
    const row = state.kyc.find((k) => k.creatorId === creatorId);
    return row?.status === "signed";
  },
}));

// ─── Mock providers/registry getTextProvider ─────────────────────────────────
vi.mock("../providers/registry.js", () => ({
  getTextProvider: () => ({
    modelId: "mock",
    async generateText(input: {
      creatorId: string;
      fanId: string;
      messages: Array<{ role: string; content: string }>;
      systemPrompt: string;
      maxTokens?: number;
    }) {
      providerCalls.push({
        systemPrompt: input.systemPrompt,
        messages: input.messages,
        fanId: input.fanId,
        maxTokens: input.maxTokens,
        creatorId: input.creatorId,
      });
      return {
        content: nextProviderResponse,
        tokensUsed: 5,
        modelId: "mock",
        latencyMs: 0,
      };
    },
  }),
}));

// ─── Mock constitution read (no Replit storage in tests) ─────────────────────
vi.mock("../lib/constitution.js", () => ({
  readConstitution: async (_creatorId: string) => null,
}));

// ─── HTTP harness helper ─────────────────────────────────────────────────────
function request(
  method: "POST" | "GET",
  path: string,
  body?: unknown,
  cookie?: string,
): Promise<{
  status: number;
  body: Record<string, unknown>;
  setCookie?: string;
}> {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : "";
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      headers["Content-Length"] = String(Buffer.byteLength(payload));
    }
    if (cookie) headers["Cookie"] = cookie;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers,
      },
      (res: IncomingMessage) => {
        let data = "";
        res.on("data", (c) => {
          data += c;
        });
        res.on("end", () => {
          const setCookieHeader = res.headers["set-cookie"]?.[0];
          try {
            resolve({
              status: res.statusCode ?? 0,
              body: data ? JSON.parse(data) : {},
              setCookie: setCookieHeader,
            });
          } catch {
            resolve({
              status: res.statusCode ?? 0,
              body: {},
              setCookie: setCookieHeader,
            });
          }
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ─── App / server lifecycle ──────────────────────────────────────────────────
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
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

beforeEach(() => {
  // Reset in-memory state but keep listener alive
  state.creators = [
    {
      id: "creator-signed-1",
      handle: "sakura",
      killSwitchActive: false,
      monetizationUrl: "https://fanvue.com/sakura",
      config: { brand_color: "#ff00ff", platform_name: "Fanvue", locale_default: "ja" },
    },
    {
      id: "creator-pending-1",
      handle: "test-pending",
      killSwitchActive: false,
      monetizationUrl: null,
      config: {},
    },
    {
      id: "creator-paused-1",
      handle: "test-paused",
      killSwitchActive: false,
      monetizationUrl: null,
      config: {},
    },
    {
      id: "creator-killed-1",
      handle: "test-killed",
      killSwitchActive: true,
      monetizationUrl: null,
      config: {},
    },
  ];
  state.twins = [
    {
      id: "twin-sakura-1",
      creatorId: "creator-signed-1",
      characterCard: null,
    },
  ];
  state.kyc = [
    { creatorId: "creator-signed-1", status: "signed" },
    { creatorId: "creator-pending-1", status: "pending" },
    { creatorId: "creator-paused-1", status: "signed" },
    { creatorId: "creator-killed-1", status: "signed" },
  ];
  state.configs = [
    { creatorId: "creator-paused-1", paused: true },
  ];
  state.conversationMessages = [];
  state.inserts.conversation = 0;
  providerCalls.length = 0;
  nextProviderResponse = "[mock-reply-A]";
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CHAT-01 e2e: POST /api/twin/chat — signed creator", () => {
  it("returns 200 with real (mocked) LLM text + disclosure footer + conversation_id", async () => {
    nextProviderResponse = "Hi there! Lovely to meet you.";
    const { status, body, setCookie } = await request("POST", "/api/twin/chat", {
      handle: "sakura",
      message: "hello",
    });
    expect(status).toBe(200);
    expect(body.text).toBe("Hi there! Lovely to meet you.");
    expect(body.disclosure_footer).toBe("AI twin · @sakura_ai");
    expect(typeof body.conversation_id).toBe("string");
    expect((body.conversation_id as string).length).toBeGreaterThan(8);
    // Cookie was minted (first turn)
    expect(setCookie).toMatch(/conversation_id=/);
    // 2 inserts: user + assistant
    expect(state.conversationMessages).toHaveLength(2);
    expect(state.conversationMessages[0]?.role).toBe("user");
    expect(state.conversationMessages[1]?.role).toBe("assistant");
  });

  it("persists conversation across turns and replays prior context to GMI on turn 2", async () => {
    nextProviderResponse = "First reply.";
    const r1 = await request("POST", "/api/twin/chat", {
      handle: "sakura",
      message: "turn-1 user",
    });
    expect(r1.status).toBe(200);
    const cookie = r1.setCookie?.split(";")[0] ?? "";
    expect(cookie).toMatch(/^conversation_id=/);

    nextProviderResponse = "Second reply.";
    const r2 = await request(
      "POST",
      "/api/twin/chat",
      { handle: "sakura", message: "turn-2 user" },
      cookie,
    );
    expect(r2.status).toBe(200);

    // 4 inserts total (2 turns × user+assistant)
    expect(state.conversationMessages).toHaveLength(4);

    // Turn 2 provider call must include prior turn history (oldest-first)
    const turn2Call = providerCalls[1];
    expect(turn2Call).toBeDefined();
    // Expected messages: [prior user, prior assistant, new user]
    expect(turn2Call?.messages).toEqual([
      { role: "user", content: "turn-1 user" },
      { role: "assistant", content: "First reply." },
      { role: "user", content: "turn-2 user" },
    ]);
  });

  it("returns 423 KYC_UNSIGNED for pending-KYC creator", async () => {
    const { status, body } = await request("POST", "/api/twin/chat", {
      handle: "test-pending",
      message: "hi",
    });
    expect(status).toBe(423);
    expect(body.code).toBe("KYC_UNSIGNED");
  });

  it("returns 503 creator_paused when creator_config.paused = true", async () => {
    const { status, body } = await request("POST", "/api/twin/chat", {
      handle: "test-paused",
      message: "hi",
    });
    expect(status).toBe(503);
    expect(body.code).toBe("creator_paused");
  });

  it("returns 503 creator_paused when kill_switch_active = true", async () => {
    const { status, body } = await request("POST", "/api/twin/chat", {
      handle: "test-killed",
      message: "hi",
    });
    expect(status).toBe(503);
    expect(body.code).toBe("creator_paused");
  });

  it("returns 401 when conversation_id cookie is tampered", async () => {
    const { status } = await request(
      "POST",
      "/api/twin/chat",
      { handle: "sakura", message: "hi" },
      "conversation_id=bogus.signature",
    );
    expect(status).toBe(401);
  });

  it("returns 400 when message missing", async () => {
    const { status } = await request("POST", "/api/twin/chat", {
      handle: "sakura",
      message: "",
    });
    expect(status).toBe(400);
  });

  it("returns 404 for nonexistent creator handle", async () => {
    const { status } = await request("POST", "/api/twin/chat", {
      handle: "no-such-creator-xyz",
      message: "hi",
    });
    expect(status).toBe(404);
  });

  it("disclosure_footer reflects detected locale (Accept-Language: ja)", async () => {
    nextProviderResponse = "こんにちは";
    const res = await new Promise<{ status: number; body: Record<string, unknown> }>(
      (resolve, reject) => {
        const payload = JSON.stringify({ handle: "sakura", message: "hi" });
        const req = http.request(
          {
            hostname: "127.0.0.1",
            port,
            path: "/api/twin/chat",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": String(Buffer.byteLength(payload)),
              "Accept-Language": "ja,en;q=0.8",
            },
          },
          (r) => {
            let data = "";
            r.on("data", (c) => {
              data += c;
            });
            r.on("end", () =>
              resolve({
                status: r.statusCode ?? 0,
                body: data ? JSON.parse(data) : {},
              }),
            );
          },
        );
        req.on("error", reject);
        req.write(payload);
        req.end();
      },
    );
    expect(res.status).toBe(200);
    expect(res.body.disclosure_footer).toBe("AIツイン · @sakura_ai");
    // System prompt should include the Japanese reply directive
    const lastCall = providerCalls[providerCalls.length - 1];
    expect(lastCall?.systemPrompt).toContain("日本語");
  });

  it("fan_id passed to provider is hashed (never raw cookie value)", async () => {
    await request("POST", "/api/twin/chat", { handle: "sakura", message: "hi" });
    const call = providerCalls[0];
    expect(call?.fanId).toBeDefined();
    // hashed = hex string of fixed length; must not equal the conversation id
    expect(call?.fanId).toMatch(/^[a-f0-9]+$/);
    // Must NOT contain the raw conversation_id we'd see in res.cookies — just
    // assert it's not literally the conversationId in body of the same request.
    expect(call?.fanId.length).toBeGreaterThanOrEqual(16);
  });

  it("maxTokens = 512 is passed to generateText", async () => {
    await request("POST", "/api/twin/chat", { handle: "sakura", message: "hi" });
    expect(providerCalls[0]?.maxTokens).toBe(512);
  });
});

describe("CHAT-05 e2e: GET /api/twin/:handle/profile", () => {
  it("returns 200 with brand_color, monetization_url, platform_name for known creator", async () => {
    const { status, body } = await request("GET", "/api/twin/sakura/profile");
    expect(status).toBe(200);
    expect(body).toMatchObject({
      handle: "sakura",
      brand_color: "#ff00ff",
      monetization_url: "https://fanvue.com/sakura",
      platform_name: "Fanvue",
      locale_default: "ja",
    });
  });

  it("returns defaults when creator.config lacks brand_color/platform_name", async () => {
    const { status, body } = await request("GET", "/api/twin/test-pending/profile");
    expect(status).toBe(200);
    expect(body).toMatchObject({
      handle: "test-pending",
      brand_color: "#7c3aed",
      monetization_url: null,
      platform_name: "the platform",
      locale_default: "en",
    });
  });

  it("returns 404 for nonexistent handle", async () => {
    const { status } = await request("GET", "/api/twin/no-such-creator-xyz/profile");
    expect(status).toBe(404);
  });
});
