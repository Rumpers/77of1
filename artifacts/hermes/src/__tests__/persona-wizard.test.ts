// RED test for ONBOARD-01 — will GREEN when plan 02-07 replaces the in-memory Map state machine
// in artifacts/hermes/src/consent.ts with Telegraf Scenes.WizardScene backed by @telegraf/session/pg.
import { describe, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  consentGrantsTable: {},
}));

describe("ONBOARD-01: Hermes persona / consent WizardScene", () => {
  it.todo(
    "GREENs in plan 02-07: wizard enters from /consent and walks creator through every CONSENT_ITEMS entry in order",
  );
  it.todo(
    "GREENs in plan 02-07: scene session state persists across bot restarts (Replit redeploy) via @telegraf/session/pg",
  );
  it.todo(
    "GREENs in plan 02-07: CONFIRM transitions write consent_grants row with consent_version and ip_hash via telegramIpHash()",
  );
  it.todo(
    "GREENs in plan 02-07: /consent_status after partial completion resumes scene at the right step",
  );
});
