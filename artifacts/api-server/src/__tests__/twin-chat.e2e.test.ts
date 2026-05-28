// RED test for CHAT-01 — will GREEN when plan 02-03 ships the full fan twin chat pipeline.
// E2E: POST /api/twin/chat with valid handle + HMAC conversation_id → 200 + safe reply.
// Uses HTTP harness pattern from kyc-gate.e2e.test.ts (DB-gated with DATABASE_URL).
import { describe, it } from "vitest";

describe("CHAT-01: POST /api/twin/chat (e2e)", () => {
  it.todo(
    "GREENs in plan 02-03: returns 200 + assistant message when fan has valid HMAC conversation_id and creator KYC is signed",
  );
  it.todo(
    "GREENs in plan 02-03: returns 423 when creator KYC is pending (KYC gate enforced)",
  );
  it.todo(
    "GREENs in plan 02-03: returns 403 when HMAC conversation_id signature does not match",
  );
  it.todo(
    "GREENs in plan 02-03: appends disclosure footer 'AI twin · @{handle}_ai' to every reply (COMPLY-01)",
  );
});
