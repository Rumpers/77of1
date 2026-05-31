import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarketingComparison, MarketingLanding } from "./home";

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

test("MarketingLanding exposes three distinct site directions", () => {
  const expectations = [
    { variant: "steady-pay" as const, label: /Steady Pay/, layout: /Calm editorial/ },
    { variant: "violet-pop" as const, label: /Violet Pop/, layout: /Playful card stack/ },
    { variant: "spotlight" as const, label: /Spotlight/, layout: /Dark stage/ },
  ];

  for (const { variant, label, layout } of expectations) {
    const html = renderToStaticMarkup(
      React.createElement(MarketingLanding, {
        locale: "en",
        variant,
        onLocaleChange: () => {},
      }),
    );

    assert.match(html, label);
    assert.match(html, layout);
    assert.match(html, /Compare all three/);
  }
});

test("MarketingComparison points at three separate preview URLs", () => {
  const html = renderToStaticMarkup(
    React.createElement(MarketingComparison, {
      locale: "en",
    }),
  );

  assert.match(html, /Three different sites, same copy\./);
  assert.match(html, /\/en\?variant=steady-pay/);
  assert.match(html, /\/en\?variant=violet-pop/);
  assert.match(html, /\/en\?variant=spotlight/);
  assert.match(html, /\/en\/compare/);
});
