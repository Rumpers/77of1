import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketingLanding } from "./home";

test("MarketingLanding shows the locked hero copy and a short nav", () => {
  const html = renderToStaticMarkup(
    React.createElement(MarketingLanding, {
      locale: "en",
      onLocaleChange: () => {},
    }),
  );

  assert.match(html, /Your AI twin, built and run for you\./);
  assert.match(html, /Talk to Lala/);
  assert.match(html, /What it does/);
  assert.match(html, /How it works/);
  assert.match(html, /Features/);
  assert.match(html, /EN/);
  assert.match(html, /日本語/);
  assert.match(html, /繁中/);
});
