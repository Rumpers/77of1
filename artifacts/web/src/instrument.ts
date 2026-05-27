import * as Sentry from "@sentry/react";

// Sentry error capture is necessary (no PII sent, scrubbed below) — always on.
// Session replay and performance tracing are analytics — gated by consent in
// cookie-consent.ts (replaysSessionSampleRate stays 0 here; activated by SDK).
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
  tracesSampleRate: 0,      // traces = analytics — not enabled without consent
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
    if (event.extra) {
      const scrubbed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(event.extra)) {
        scrubbed[k] = ["fan_id", "fanId", "email", "message"].includes(k)
          ? "[Scrubbed]"
          : v;
      }
      event.extra = scrubbed;
    }
    return event;
  },
});
