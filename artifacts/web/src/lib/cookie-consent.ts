/**
 * Cookie / tracking consent SDK.
 *
 * Strictest-law model: non-essential categories require explicit opt-in
 * regardless of region (covers GDPR, APPI, PDPA day-1).
 *
 * Queryable surface:
 *   import { hasConsented, getConsentState, onConsentChange } from "@/lib/cookie-consent";
 */

export type ConsentCategory = "necessary" | "analytics" | "marketing";

export interface ConsentPreferences {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
}

export interface ConsentState {
  /** Whether the user has made an explicit choice (accept or customise). */
  decided: boolean;
  categories: ConsentPreferences;
  decidedAt: string | null;
  version: string;
}

const STORAGE_KEY = "7of1_cookie_consent";
const CONSENT_VERSION = "v1";

function defaultState(): ConsentState {
  return {
    decided: false,
    categories: { necessary: true, analytics: false, marketing: false },
    decidedAt: null,
    version: CONSENT_VERSION,
  };
}

// ── storage ─────────────────────────────────────────────────────────────────

function readFromStorage(): ConsentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (parsed.version !== CONSENT_VERSION) return defaultState();
    return {
      decided: parsed.decided ?? false,
      categories: {
        necessary: true,
        analytics: parsed.categories?.analytics ?? false,
        marketing: parsed.categories?.marketing ?? false,
      },
      decidedAt: parsed.decidedAt ?? null,
      version: CONSENT_VERSION,
    };
  } catch {
    return defaultState();
  }
}

function writeToStorage(state: ConsentState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // private browsing or webview sandbox — best-effort
  }
}

// ── in-memory state + observers ─────────────────────────────────────────────

let _state: ConsentState = readFromStorage();
const _listeners: Array<(s: ConsentState) => void> = [];

function notify() {
  for (const fn of _listeners) fn(_state);
}

// ── public API ───────────────────────────────────────────────────────────────

/** Returns the full current consent state. */
export function getConsentState(): ConsentState {
  return _state;
}

/** Returns true if the given category is allowed. Necessary is always true. */
export function hasConsented(category: ConsentCategory): boolean {
  if (category === "necessary") return true;
  return _state.decided && _state.categories[category] === true;
}

/** True when the banner should be shown (no decision yet). */
export function needsBanner(): boolean {
  return !_state.decided;
}

/**
 * Record the user's consent choices and persist them.
 * Fires all registered listeners and triggers analytics loaders.
 */
export function saveConsent(prefs: Omit<ConsentPreferences, "necessary">): void {
  _state = {
    decided: true,
    categories: { necessary: true, ...prefs },
    decidedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  writeToStorage(_state);
  notify();
  _applyTracking(_state);
}

/** Accept all non-essential categories. */
export function acceptAll(): void {
  saveConsent({ analytics: true, marketing: true });
}

/** Reject all non-essential categories (only necessary remains). */
export function rejectAll(): void {
  saveConsent({ analytics: false, marketing: false });
}

/** Subscribe to consent state changes. Returns an unsubscribe function. */
export function onConsentChange(fn: (state: ConsentState) => void): () => void {
  _listeners.push(fn);
  return () => {
    const i = _listeners.indexOf(fn);
    if (i >= 0) _listeners.splice(i, 1);
  };
}

// ── tracking loaders (consent-gated) ────────────────────────────────────────

let _analyticsLoaded = false;
let _marketingLoaded = false;

function _applyTracking(state: ConsentState): void {
  if (state.categories.analytics && !_analyticsLoaded) {
    _loadPostHog();
    _analyticsLoaded = true;
  }
  if (state.categories.marketing && !_marketingLoaded) {
    _loadGA4();
    _marketingLoaded = true;
  }
}

function _loadPostHog(): void {
  const key = (import.meta as { env?: Record<string, string> }).env?.VITE_POSTHOG_KEY;
  const host = (import.meta as { env?: Record<string, string> }).env?.VITE_POSTHOG_HOST ?? "https://app.posthog.com";
  if (!key) return;

  // Dynamic import avoids bundling posthog-js unless actually needed
  import(/* @vite-ignore */ "posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: host,
        persistence: "localStorage+cookie",
        autocapture: true,
        capture_pageview: true,
        disable_session_recording: true,
      });
    })
    .catch(() => {
      // posthog-js not installed — no-op; add to devDependencies to enable
    });
}

function _loadGA4(): void {
  const measurementId = (import.meta as { env?: Record<string, string> }).env?.VITE_GA4_MEASUREMENT_ID;
  if (!measurementId) return;
  if (document.querySelector(`script[src*="googletagmanager"]`)) return;

  const s = document.createElement("script");
  s.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  s.async = true;
  document.head.appendChild(s);

  (window as Window & { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }).dataLayer ??= [];
  (window as Window & { gtag?: (...args: unknown[]) => void }).gtag = function (...args: unknown[]) {
    ((window as Window & { dataLayer?: unknown[] }).dataLayer as unknown[]).push(args);
  };
  (window as Window & { gtag?: (...args: unknown[]) => void }).gtag!("js", new Date());
  (window as Window & { gtag?: (...args: unknown[]) => void }).gtag!("config", measurementId, {
    anonymize_ip: true,
    send_page_view: true,
  });
}

// ── apply on load (handles returning visitors who already consented) ─────────
_applyTracking(_state);
