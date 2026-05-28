// RED test for COMPLY-01 — will GREEN when plan 02-03 ships getDisclosureFooter(locale, handle).
// SB 243 mandate: every AI twin message must include AI disclosure footer.
// Unit: pure function — no DB or fetch mocks needed.
import { describe, it } from "vitest";

describe("COMPLY-01: SB 243 AI disclosure footer", () => {
  it.todo(
    "GREENs in plan 02-03: returns 'AI twin · @{handle}_ai' for locale='en'",
  );
  it.todo(
    "GREENs in plan 02-03: returns locale-localized footer for ja / zh-TW (e.g. 'AI ツイン · @{handle}_ai')",
  );
  it.todo(
    "GREENs in plan 02-03: footer is appended to every assistant reply in /api/twin/chat (twin-chat.e2e.test.ts covers integration)",
  );
});
