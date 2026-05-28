// RED test for COMPLY-02 — will GREEN when plan 02-05 ships crisis helpline injection.
// SB 243 Day 1 mandate: when L1/L3 self-harm score > threshold, inject crisis helpline text per locale.
// Unit: composeFlaggedReply(moderationResult, locale) returns helpline-injected string when self-harm flagged.
import { describe, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  safetyAuditLogTable: {},
}));

describe("COMPLY-02: SB 243 self-harm helpline injection", () => {
  it.todo(
    "GREENs in plan 02-05: when self-harm flagged + locale=ja, reply contains '0120-783-556' (いのちの電話)",
  );
  it.todo(
    "GREENs in plan 02-05: when self-harm flagged + locale=zh-TW, reply contains '1925'",
  );
  it.todo(
    "GREENs in plan 02-05: when self-harm flagged + locale=en, reply contains '988'",
  );
  it.todo(
    "GREENs in plan 02-05: does NOT silently refuse — every self-harm flag MUST return a non-empty helpline message (private right of action, $1000/violation)",
  );
});
