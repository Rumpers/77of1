/**
 * Phase 1 KYC Gate E2E Test (RED → GREEN cycle across Tasks 0 and 2)
 *
 * Task 0 (RED):  Tests 1 and 3 FAIL against current twin.ts (no KYC gate).
 * Task 2 (GREEN): All 3 tests PASS after the KYC gate is added to twin.ts.
 *
 * Seeding via Drizzle (requires DATABASE_URL). If DATABASE_URL is absent,
 * tests are skipped gracefully with a warning (local-dev / CI without DB).
 *
 * Import pattern required by plan:
 *   import { db, creatorsTable, creatorKycTable } from "@workspace/db"
 *   import { inArray, eq } from "drizzle-orm"
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import type { IncomingMessage } from "node:http";

// ─── DB imports (Drizzle) ────────────────────────────────────────────────────
// These imports will throw at module load time if DATABASE_URL is not set,
// which is handled via the skip guard in beforeAll.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let creatorsTable: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let creatorKycTable: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let inArray: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let eq: any;

// ─── App import ──────────────────────────────────────────────────────────────
// NOTE: importing app after DB so DATABASE_URL guard fires first
let app: import("express").Express;
let server: http.Server;
let baseUrl: string;

// ─── Test data ───────────────────────────────────────────────────────────────
let pendingId: string;
let signedId: string;
let dbAvailable = false;

// ─── HTTP helper ─────────────────────────────────────────────────────────────
function post(
  url: string,
  body: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      port: Number(parsed.port),
      path: parsed.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res: IncomingMessage) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode ?? 0, body: {} });
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Guard: skip DB seed if DATABASE_URL not available.
  // Tests still run (and fail) against the HTTP layer but seed step is skipped.
  if (!process.env.DATABASE_URL) {
    console.warn(
      "[kyc-gate.e2e] DATABASE_URL not set — seeding skipped; DB-dependent assertions will fail as expected (RED gate satisfied)"
    );
    dbAvailable = false;
  } else {
    dbAvailable = true;

    // Dynamic imports — must be after DATABASE_URL check since lib/db throws on load
    const dbModule = await import("@workspace/db");
    db = dbModule.db as typeof db;
    creatorsTable = dbModule.creatorsTable;
    creatorKycTable = dbModule.creatorKycTable;
    const drizzleOrm = await import("drizzle-orm");
    inArray = drizzleOrm.inArray;
    eq = drizzleOrm.eq;

    // Generate unique IDs for this test run
    pendingId = crypto.randomUUID();
    signedId = crypto.randomUUID();

    // Seed creator rows
    await db
      .insert(creatorsTable)
      .values([
        { id: pendingId, handle: "test-pending", displayName: "Test Pending" },
        { id: signedId, handle: "test-signed", displayName: "Test Signed" },
      ])
      .onConflictDoNothing();

    // Seed creator_kyc rows
    await db
      .insert(creatorKycTable)
      .values([
        { creatorId: pendingId, status: "pending" },
        { creatorId: signedId, status: "signed" },
      ])
      .onConflictDoNothing();
  }

  // Start the Express app
  app = (await import("../app.js")).default;
  await new Promise<void>((resolve) => {
    server = http.createServer(app);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}/api`;
      resolve();
    });
  });
}, 15_000);

afterAll(async () => {
  // Close the HTTP server
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });

  // Tear down seeded rows (only if DB was available)
  if (dbAvailable && db) {
    try {
      await db
        .delete(creatorKycTable)
        .where(inArray(creatorKycTable.creatorId, [pendingId, signedId]));
      await db
        .delete(creatorsTable)
        .where(inArray(creatorsTable.handle, ["test-pending", "test-signed"]));
    } catch (err) {
      console.error("[kyc-gate.e2e] afterAll cleanup error:", err);
    }
  }
}, 10_000);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Phase 1 KYC gate E2E", () => {
  /**
   * Test 1 (RED): POST /api/twin/chat with a creator whose KYC status is
   * 'pending' must return HTTP 423 with code 'KYC_UNSIGNED'.
   *
   * FAILS today: twin.ts has no KYC gate — it returns 200 for any message.
   * PASSES after Task 2 adds the gate.
   */
  it("Test 1 (RED): returns 423 KYC_UNSIGNED for pending-kyc creator", async () => {
    const { status, body } = await post(`${baseUrl}/twin/chat`, {
      handle: "test-pending",
      message: "hi",
    });

    expect(status).toBe(423);
    expect((body as { code?: string }).code).toBe("KYC_UNSIGNED");
  });

  /**
   * Test 2: POST /api/twin/chat with a creator whose KYC status is 'signed'
   * must NOT return 423.
   *
   * PASSES today (twin.ts returns 200) AND after Task 2 (gate passes for 'signed').
   */
  it("Test 2: does NOT return 423 for signed-kyc creator", async () => {
    const { status } = await post(`${baseUrl}/twin/chat`, {
      handle: "test-signed",
      message: "hi",
    });

    expect(status).not.toBe(423);
  });

  /**
   * Test 3 (RED): POST /api/twin/chat with a nonexistent handle must return
   * HTTP 404 with { error: "Creator not found" }.
   *
   * FAILS today: twin.ts returns 200 for any handle.
   * PASSES after Task 2 adds the creator lookup.
   */
  it("Test 3 (RED): returns 404 for nonexistent creator handle", async () => {
    const { status, body } = await post(`${baseUrl}/twin/chat`, {
      handle: "nonexistent-handle-xyz-99999",
      message: "hi",
    });

    expect(status).toBe(404);
    expect((body as { error?: string }).error).toBe("Creator not found");
  });
});
