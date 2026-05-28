// RED test for MOD-01 — will GREEN when plan 02-05 ships L1 OpenAI moderation on fan input.
// Unit: getModeratorProvider().moderate(prompt) → { flagged, categories, scores }.
// Mocks @workspace/db + global fetch (no real OpenAI call in unit tests).
import { describe, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  safetyAuditLogTable: {},
}));

describe("MOD-01: L1 fan-input moderation (OpenAI omni-moderation-latest)", () => {
  it.todo(
    "GREENs in plan 02-05: returns { flagged: false } when fan input is benign",
  );
  it.todo(
    "GREENs in plan 02-05: returns { flagged: true, categories: ['self-harm'] } when fan input is self-harm content",
  );
  it.todo(
    "GREENs in plan 02-05: writes safety_audit_log row when flagged=true with hashed fan_id and category list",
  );
  it.todo(
    "GREENs in plan 02-05: routes through Helicone proxy when HELICONE_API_KEY is set",
  );
});
