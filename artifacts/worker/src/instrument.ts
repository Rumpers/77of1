import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? "development",
  release: process.env.SENTRY_RELEASE ?? process.env.GIT_SHA,
  enabled: !!process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
    if (event.extra) {
      const scrubbed: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(event.extra)) {
        scrubbed[k] = ["fan_id", "fanId", "prompt", "message", "email"].includes(k)
          ? "[Scrubbed]"
          : v;
      }
      event.extra = scrubbed;
    }
    return event;
  },
});

export { Sentry };
