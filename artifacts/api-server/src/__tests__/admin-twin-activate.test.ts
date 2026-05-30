// POST /api/admin/twin/:creatorId/activate — founder-auth gate + eval gate (04-03).
//
// Tests the three required behavior cases:
//   1. No auth (or bad auth) → 401
//   2. Auth ok + isGoLiveEligible returns false → 422 eval_gate_failed
//   3. Auth ok + isGoLiveEligible returns true → 200 + twins.status update

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";

// ─── Env setup (BEFORE any module imports the app) ───────────────────────────
process.env.HMAC_CONVERSATION_SECRET =
  process.env.HMAC_CONVERSATION_SECRET ||
  "test-secret-min-32-chars-aaaaaaaaaaaaaaa";
process.env.TEXT_PROVIDER = "mock";
process.env.MODERATOR_PROVIDER = "mock";

const TEST_ADMIN_TOKEN = "test-admin-token-for-unit-tests-only";
process.env.ADMIN_API_TOKEN = TEST_ADMIN_TOKEN;

// ─── Mock @workspace/db ──────────────────────────────────────────────────────
const dbUpdateCalls: Array<{
  table: string;
  set: Record<string, unknown>;
  whereCreatorId: string;
}> = [];

const twinsTable = {
  __name: "twins",
  id: { __col: "id" },
  creatorId: { __col: "creatorId" },
  status: { __col: "status" },
};

vi.mock("@workspace/db", () => {
  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
          orderBy: () => ({ limit: () => Promise.resolve([]) }),
        }),
      }),
    }),
    update: (table: { __name: string }) => ({
      set: (values: Record<string, unknown>) => ({
        where: (pred: { col?: { __col: string }; value?: unknown }) => {
          dbUpdateCalls.push({
            table: table.__name,
            set: values,
            whereCreatorId: String(pred?.value ?? ""),
          });
          return Promise.resolve();
        },
      }),
    }),
  };
  return { db, twinsTable };
});

vi.mock("drizzle-orm", () => ({
  eq: (col: { __col: string }, value: unknown) => ({ __pred: "eq", col, value }),
  and: (...args: unknown[]) => ({ __pred: "and", args }),
  desc: (col: unknown) => ({ __order: "desc", col }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...vals: unknown[]) => ({ __sql: strings, vals }),
    { raw: (s: string) => ({ __sql_raw: s }) },
  ),
}));

// ─── Mock @workspace/eval — isGoLiveEligible is the key control ──────────────
let mockIsGoLiveEligible = false;

vi.mock("@workspace/eval", () => ({
  isGoLiveEligible: async (_creatorId: string): Promise<boolean> => {
    return mockIsGoLiveEligible;
  },
}));

// ─── HTTP harness helper ─────────────────────────────────────────────────────
function request(
  method: "POST",
  path: string,
  headers?: Record<string, string>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        "Content-Length": "0",
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => { data += c; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: data ? JSON.parse(data) : {} });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: {} });
        }
      });
    });
    req.on("error", reject);
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
  dbUpdateCalls.length = 0;
  mockIsGoLiveEligible = false;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

const VALID_CREATOR_ID = "550e8400-e29b-41d4-a716-446655440000";
const ENDPOINT = `/api/admin/twin/${VALID_CREATOR_ID}/activate`;

describe("POST /api/admin/twin/:creatorId/activate", () => {
  it("returns 401 when no Authorization header is provided", async () => {
    const { status, body } = await request("POST", ENDPOINT);
    expect(status).toBe(401);
    expect(body.code).toBe("unauthorized");
  });

  it("returns 401 when a wrong bearer token is supplied", async () => {
    const { status, body } = await request("POST", ENDPOINT, {
      Authorization: "Bearer wrong-token-not-the-real-one",
    });
    expect(status).toBe(401);
    expect(body.code).toBe("unauthorized");
  });

  it("returns 422 eval_gate_failed when auth passes but isGoLiveEligible is false", async () => {
    mockIsGoLiveEligible = false;
    const { status, body } = await request("POST", ENDPOINT, {
      Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
    });
    expect(status).toBe(422);
    expect(body.code).toBe("eval_gate_failed");
    // twins.status must NOT have been updated
    expect(dbUpdateCalls).toHaveLength(0);
    // 422 body must NOT mention specific eval cases (leak prevention)
    expect(JSON.stringify(body)).not.toContain("case");
    expect(JSON.stringify(body)).not.toContain("HL-");
    expect(JSON.stringify(body)).not.toContain("PI-");
  });

  it("returns 200 and updates twins.status when auth passes and isGoLiveEligible is true", async () => {
    mockIsGoLiveEligible = true;
    const { status, body } = await request("POST", ENDPOINT, {
      Authorization: `Bearer ${TEST_ADMIN_TOKEN}`,
    });
    expect(status).toBe(200);
    expect(body.status).toBe("active");
    // twins.status must have been updated to "active"
    expect(dbUpdateCalls).toHaveLength(1);
    expect(dbUpdateCalls[0]?.table).toBe("twins");
    expect(dbUpdateCalls[0]?.set).toMatchObject({ status: "active" });
    expect(dbUpdateCalls[0]?.whereCreatorId).toBe(VALID_CREATOR_ID);
  });

  it("returns 400 when :creatorId is not a valid UUID", async () => {
    const { status } = await request(
      "POST",
      "/api/admin/twin/not-a-uuid/activate",
      { Authorization: `Bearer ${TEST_ADMIN_TOKEN}` },
    );
    expect(status).toBe(400);
  });
});
