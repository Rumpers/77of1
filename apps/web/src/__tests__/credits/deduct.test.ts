import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock must be hoisted before route import
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import { POST } from "../../app/api/credits/deduct/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/credits/deduct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function mockRpc(response: { data: unknown; error: null | { message: string } }) {
  const rpc = vi.fn().mockResolvedValue(response);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(createClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createClient>);
  return rpc;
}

const validBody = {
  creatorId: "creator-uuid",
  fanId: "fan-uuid",
  interactionId: "interaction-123",
  cost: 5,
};

beforeEach(() => {
  process.env.SUPABASE_URL = "http://localhost";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
  vi.clearAllMocks();
});

// ─── Input validation ──────────────────────────────────────────────────────────

describe("POST /api/credits/deduct — validation", () => {
  it("returns 400 when required fields are missing", async () => {
    mockRpc({ data: null, error: null });
    const res = await POST(makeRequest({ creatorId: "x" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Missing required fields");
  });

  it("returns 400 for float cost", async () => {
    mockRpc({ data: null, error: null });
    const res = await POST(makeRequest({ ...validBody, cost: 5.5 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for zero cost", async () => {
    mockRpc({ data: null, error: null });
    const res = await POST(makeRequest({ ...validBody, cost: 0 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative cost", async () => {
    mockRpc({ data: null, error: null });
    const res = await POST(makeRequest({ ...validBody, cost: -1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON body", async () => {
    const req = new NextRequest("http://localhost/api/credits/deduct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ─── RPC delegation ───────────────────────────────────────────────────────────

describe("POST /api/credits/deduct — RPC call", () => {
  it("calls deduct_credits RPC with correct parameters", async () => {
    const rpc = mockRpc({
      data: { success: true, remainingBalance: 95 },
      error: null,
    });

    await POST(makeRequest(validBody));

    expect(rpc).toHaveBeenCalledWith("deduct_credits", {
      p_fan_id: "fan-uuid",
      p_creator_id: "creator-uuid",
      p_interaction_id: "interaction-123",
      p_cost: 5,
    });
  });

  it("returns 500 when RPC returns a database error", async () => {
    mockRpc({ data: null, error: { message: "db failure" } });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
  });
});

// ─── Success path ─────────────────────────────────────────────────────────────

describe("POST /api/credits/deduct — success", () => {
  it("returns 200 with success and remainingBalance", async () => {
    mockRpc({ data: { success: true, remainingBalance: 95 }, error: null });

    const res = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.remainingBalance).toBe(95);
  });
});

// ─── Error paths ──────────────────────────────────────────────────────────────

describe("POST /api/credits/deduct — error responses", () => {
  it("returns 402 when insufficient credits", async () => {
    mockRpc({
      data: { success: false, error: "insufficient_credits", remainingBalance: 3 },
      error: null,
    });

    const res = await POST(makeRequest(validBody));
    const json = await res.json();

    expect(res.status).toBe(402);
    expect(json.remainingBalance).toBe(3);
  });

  it("returns 404 when fan account not found", async () => {
    mockRpc({ data: { success: false, error: "fan_not_found" }, error: null });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
  });

  it("returns 409 for duplicate interaction ID", async () => {
    mockRpc({ data: { success: false, error: "duplicate_transaction" }, error: null });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(409);
  });

  it("returns 422 for unknown RPC error codes", async () => {
    mockRpc({ data: { success: false, error: "invalid_cost" }, error: null });
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(422);
  });
});

// ─── Race condition: concurrent deductions ────────────────────────────────────
// The DB-level race safety is provided by SELECT … FOR UPDATE in deduct_credits().
// This test verifies the API layer correctly delegates all concurrent calls to the RPC
// without short-circuiting or dropping requests.

describe("POST /api/credits/deduct — concurrent requests", () => {
  it("10 simultaneous deductions all reach the RPC (no API-layer drops)", async () => {
    let callCount = 0;
    const rpc = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        data: { success: true, remainingBalance: 100 - callCount },
        error: null,
      };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createClient>);

    const requests = Array.from({ length: 10 }, (_, i) =>
      POST(makeRequest({ ...validBody, interactionId: `id-${i}` }))
    );
    const results = await Promise.all(requests);

    // All 10 reached the RPC — none were dropped by the API layer
    expect(callCount).toBe(10);
    // All returned success
    expect(results.every((r) => r.status === 200)).toBe(true);
  });

  it("each concurrent deduction carries the correct cost to the RPC", async () => {
    const rpcs: Array<{ p_cost: number }> = [];
    const rpc = vi.fn().mockImplementation(async (_fn: string, params: { p_cost: number }) => {
      rpcs.push(params);
      return { data: { success: true, remainingBalance: 90 }, error: null };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(createClient).mockReturnValue({ rpc } as unknown as ReturnType<typeof createClient>);

    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        POST(makeRequest({ ...validBody, interactionId: `id-${i}`, cost: i + 1 }))
      )
    );

    // Costs were passed through correctly (order may vary)
    const costs = rpcs.map((p) => p.p_cost).sort((a, b) => a - b);
    expect(costs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});
