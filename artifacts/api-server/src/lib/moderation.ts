// Re-export shim for the moderation pipeline — moved to @workspace/twin-runtime
// in plan 02-06a so the worker (artifacts/worker) and fan-twin can import the
// same L1/L3/L4/L5/L6 pipeline without reaching into api-server's source.
//
// This shim REGISTERS api-server's `getModeratorProvider` (which knows about
// OpenAiModeratorProvider + MockModeratorProvider) as the active factory for
// twin-runtime's moderation engine. Registration uses a LAZY lookup wrapper
// instead of binding the symbol at module load — this keeps existing test
// `vi.mock("../providers/registry.js", () => ({ getTextProvider: ... }))`
// invocations working (those mocks don't expose getModeratorProvider; binding
// eagerly would throw at module load). The dynamic require defers the lookup
// until the first L1/L3 call, by which point the test environment has either
// set `MODERATOR_PROVIDER=mock` (registry returns the mock without OpenAI) or
// the test has provided its own stub.

import type { IModeratorProvider } from "@workspace/twin-runtime/provider-types";
import { setModeratorProviderFactory } from "@workspace/twin-runtime/moderation";

// Eagerly resolve the registry at module load. Vitest's vi.mock() hoists
// before this import runs, so test files that mock "../providers/registry.js"
// get their stub; production gets the real registry.
//
// IMPORTANT: existing vi.mock setups in the test suite (e.g. twin-chat.e2e)
// stub only `getTextProvider` and leave `getModeratorProvider` undefined.
// The factory below tolerates that by throwing inside its body — moderation.ts
// in twin-runtime catches the throw and FAILS OPEN (`{ flagged: false }`),
// preserving the pre-02-06a test behaviour bit-for-bit.
import * as registry from "../providers/registry.js";

setModeratorProviderFactory((): IModeratorProvider => {
  const getter = (
    registry as { getModeratorProvider?: () => IModeratorProvider }
  ).getModeratorProvider;
  if (typeof getter !== "function") {
    // No getModeratorProvider available — typically because a test mocked
    // ../providers/registry.js without exposing it. Throw so twin-runtime's
    // FAIL-OPEN catch block fires (existing pre-02-06a behaviour).
    throw new Error(
      "getModeratorProvider is not available on ../providers/registry.js — " +
        "test mock or registry stub is missing the export.",
    );
  }
  return getter();
});

export * from "@workspace/twin-runtime/moderation";
