// GREEN test for I18N-02 — inline detectLocale(req) (D-02-14: no i18next-http-middleware).
import { describe, expect, it } from "vitest";
import { detectLocale } from "../lib/locale.js";

function req(opts: {
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}) {
  return {
    headers: opts.headers ?? {},
    body: opts.body ?? {},
    query: opts.query ?? {},
  };
}

describe("I18N-02: detectLocale", () => {
  it("returns 'ja' when Accept-Language: ja,en;q=0.5", () => {
    expect(
      detectLocale(req({ headers: { "accept-language": "ja,en;q=0.5" } })),
    ).toBe("ja");
  });

  it("returns 'zh-TW' when Accept-Language: zh-TW,zh;q=0.9", () => {
    expect(
      detectLocale(
        req({ headers: { "accept-language": "zh-TW,zh;q=0.9" } }),
      ),
    ).toBe("zh-TW");
  });

  it("returns 'en' when Accept-Language is missing", () => {
    expect(detectLocale(req({}))).toBe("en");
  });

  it("returns 'en' when Accept-Language is unrecognised (e.g. 'fr')", () => {
    expect(
      detectLocale(req({ headers: { "accept-language": "fr,de;q=0.9" } })),
    ).toBe("en");
  });

  it("body.locale overrides Accept-Language when valid", () => {
    expect(
      detectLocale(
        req({
          headers: { "accept-language": "en" },
          body: { locale: "ja" },
        }),
      ),
    ).toBe("ja");
  });

  it("invalid body.locale is ignored and Accept-Language wins", () => {
    expect(
      detectLocale(
        req({
          headers: { "accept-language": "ja" },
          body: { locale: "fr" },
        }),
      ),
    ).toBe("ja");
  });

  it("query.locale is honoured when body has no locale", () => {
    expect(
      detectLocale(
        req({
          headers: { "accept-language": "en" },
          query: { locale: "zh-TW" },
        }),
      ),
    ).toBe("zh-TW");
  });

  it("matches en-US variant via prefix", () => {
    expect(
      detectLocale(req({ headers: { "accept-language": "en-US,en;q=0.9" } })),
    ).toBe("en");
  });

  it("matches zh-Hant variant to zh-TW", () => {
    expect(
      detectLocale(req({ headers: { "accept-language": "zh-Hant-HK,zh-TW" } })),
    ).toBe("zh-TW");
  });

  it("matches ja-JP variant via prefix", () => {
    expect(
      detectLocale(req({ headers: { "accept-language": "ja-JP,ja;q=0.9" } })),
    ).toBe("ja");
  });
});
