// Hard-stop filter unit tests — OF-62
// 10/10 forbidden-topic scenarios must return a decline, not a response.
// Run with: tsx src/hard-stop.test.ts
import assert from "node:assert/strict";
import { containsHardStop, buildGracefulDecline } from "./hard-stop.js";

const FORBIDDEN = ["real name", "home address", "phone number", "rival platform"];

// ── Scenario 1: explicit mention of forbidden topic ───────────────────────────
assert(
  containsHardStop("Sure, my real name is Alice!", FORBIDDEN),
  "must detect 'real name'"
);

// ── Scenario 2: case-insensitive detection ────────────────────────────────────
assert(
  containsHardStop("My REAL NAME is Alice", FORBIDDEN),
  "must detect uppercase variant"
);

// ── Scenario 3: topic in middle of sentence ───────────────────────────────────
assert(
  containsHardStop("You can find me at my home address in Tokyo", FORBIDDEN),
  "must detect 'home address' mid-sentence"
);

// ── Scenario 4: phone number in a response ────────────────────────────────────
assert(
  containsHardStop("Call me on my phone number 090-xxxx", FORBIDDEN),
  "must detect 'phone number'"
);

// ── Scenario 5: rival platform mention ───────────────────────────────────────
assert(
  containsHardStop("You should follow me on rival platform instead", FORBIDDEN),
  "must detect 'rival platform'"
);

// ── Scenario 6: mixed case multi-word forbidden topic ─────────────────────────
assert(
  containsHardStop("Tell me your PHONE NUMBER please", FORBIDDEN),
  "must detect mixed-case 'phone number'"
);

// ── Scenario 7: forbidden topic at start of string ───────────────────────────
assert(
  containsHardStop("Real name requests are something I can discuss!", FORBIDDEN),
  "must detect 'real name' at start"
);

// ── Scenario 8: forbidden topic as substring ─────────────────────────────────
assert(
  containsHardStop("myhomeaddressisX", ["homeaddress"]),
  "must detect forbidden topic as substring"
);

// ── Scenario 9: multiple topics, only one hits ───────────────────────────────
assert(
  containsHardStop("My rival platform fans miss me", FORBIDDEN),
  "must detect when only one forbidden topic matches"
);

// ── Scenario 10: empty response treated as clean ─────────────────────────────
assert(
  !containsHardStop("", FORBIDDEN),
  "empty response must not trigger hard stop"
);

// ── Clean text passes filter ──────────────────────────────────────────────────
assert(
  !containsHardStop("Hey loves! How are you doing today? 💕", FORBIDDEN),
  "clean text must pass"
);

assert(
  !containsHardStop("I'm so excited to stream later today!", FORBIDDEN),
  "unrelated text must pass"
);

// ── Empty forbidden list always returns false ─────────────────────────────────
assert(
  !containsHardStop("real name home address phone number", []),
  "empty forbidden list must always return false"
);

// ── gracefulDecline includes fan endearment ───────────────────────────────────
{
  const decline = buildGracefulDecline("loves");
  assert(decline.includes("loves"), "graceful decline must include fan endearment");
  assert(decline.length > 20, "graceful decline must be a real sentence");
  console.log("✓ graceful decline: " + decline);
}

console.log("\n✅ All hard-stop tests passed (10/10 forbidden-topic scenarios).");
