// RED test for I18N-02 — will GREEN when plan 02-02 ships inline detectLocale(req) (D-02-14: no i18next-http-middleware).
// Unit: detectLocale parses Accept-Language header; falls back to 'en' when header is missing or unrecognised.
import { describe, it } from "vitest";

describe("I18N-02: Accept-Language locale negotiation (inline, no i18next-http-middleware)", () => {
  it.todo(
    "GREENs in plan 02-02: returns 'ja' when Accept-Language: ja,en;q=0.5",
  );
  it.todo(
    "GREENs in plan 02-02: returns 'zh-TW' when Accept-Language: zh-TW,zh;q=0.9",
  );
  it.todo(
    "GREENs in plan 02-02: returns 'en' when Accept-Language is missing or unrecognised",
  );
  it.todo(
    "GREENs in plan 02-02: detected locale flows to crisis helpline routing (composeFlaggedReply) and disclosure footer",
  );
});
