// [HID-035] DSAR self-service portal — OF-135
// §16: fans get 30-day download window; creators get 72-hour self-export.
// IG/TikTok webview-safe: no popups, no custom URL schemes.
// EN / JA / ZH-TW supported.

import { useEffect, useState } from "react";
import { getMessages, isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n";

type DsarStatus = {
  latest: {
    id: string;
    requester_type: string;
    status: string;
    requested_at: string;
    ready_at: string | null;
    expires_at: string | null;
    downloaded_at: string | null;
    download_token?: string;
  } | null;
  can_request: boolean;
  next_eligible_at: string | null;
};

type RequestResult = {
  id: string;
  status: string;
  requester_type: string;
  download_token: string;
  expires_at: string;
  package_size_bytes: number;
};

const BRAND = "#7C3AED";

function getLocale(): string {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const seg = window.location.pathname.split("/").find(Boolean) ?? "";
  return isValidLocale(seg) ? seg : DEFAULT_LOCALE;
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DsarPortal() {
  const locale = getLocale();
  const t = getMessages(locale).dsar;

  const [status, setStatus] = useState<DsarStatus | null>(null);
  const [result, setResult] = useState<RequestResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);

  // Check auth + fetch DSAR status on mount
  useEffect(() => {
    async function init() {
      try {
        const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
        if (!sessionRes.ok) {
          setAuthed(false);
          setLoading(false);
          return;
        }
        const session = await sessionRes.json() as { authenticated: boolean };
        if (!session.authenticated) {
          setAuthed(false);
          setLoading(false);
          return;
        }
        setAuthed(true);

        const dsarRes = await fetch("/api/dsar", { credentials: "include" });
        if (!dsarRes.ok) throw new Error(`HTTP ${dsarRes.status}`);
        const dsarData = await dsarRes.json() as DsarStatus;
        setStatus(dsarData);
      } catch (e) {
        console.error("[dsar-portal] init error", e);
        setError(t.error_generic);
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [t.error_generic]);

  async function handleRequest() {
    setRequesting(true);
    setError(null);
    try {
      const res = await fetch("/api/dsar/request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.status === 429) {
        const data = await res.json() as { next_eligible_at?: string };
        setError(`${t.cooldown_notice} ${t.cooldown_next} ${fmt(data.next_eligible_at ?? null)}.`);
        return;
      }
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? t.error_generic);
        return;
      }
      const data = await res.json() as RequestResult;
      setResult(data);
      // Refresh status
      const dsarRes = await fetch("/api/dsar", { credentials: "include" });
      if (dsarRes.ok) setStatus(await dsarRes.json() as DsarStatus);
    } catch (e) {
      console.error("[dsar-portal] request error", e);
      setError(t.error_generic);
    } finally {
      setRequesting(false);
    }
  }

  function handleDownload(token: string) {
    window.location.href = `/api/dsar/download?token=${encodeURIComponent(token)}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <main
      style={{
        fontFamily: "system-ui, -apple-system, 'Helvetica Neue', sans-serif",
        minHeight: "100vh",
        background: "#F9FAFB",
        padding: "1.5rem 1rem",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          background: "#fff",
          borderRadius: "16px",
          padding: "1.75rem 1.5rem",
          boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "1.5rem" }}>
          <h1
            style={{
              fontSize: "1.35rem",
              fontWeight: 700,
              color: "#111827",
              margin: "0 0 0.4rem",
            }}
          >
            {t.page_title}
          </h1>
          <p style={{ fontSize: "0.875rem", color: "#6B7280", margin: 0, lineHeight: 1.55 }}>
            {t.page_subtitle}
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <p style={{ color: "#9CA3AF", fontSize: "0.875rem", textAlign: "center" }}>
            {t.loading}
          </p>
        )}

        {/* Not authenticated */}
        {!loading && authed === false && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: "10px",
              padding: "1rem",
              fontSize: "0.875rem",
              color: "#991B1B",
            }}
          >
            {t.error_auth}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            style={{
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              borderRadius: "10px",
              padding: "0.875rem 1rem",
              fontSize: "0.875rem",
              color: "#991B1B",
              marginBottom: "1rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Success: new request just submitted */}
        {!loading && result && (
          <div
            style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              marginBottom: "1.25rem",
            }}
          >
            <h2 style={{ margin: "0 0 0.4rem", fontSize: "1rem", fontWeight: 700, color: "#166534" }}>
              {t.success_title}
            </h2>
            <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#15803D", lineHeight: 1.5 }}>
              {t.success_body}
              {result.requester_type === "creator" && (
                <> {t.creator_note}</>
              )}
            </p>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#4B5563" }}>
              {t.expires_label}: {fmt(result.expires_at)}
              {" · "}
              {fmtBytes(result.package_size_bytes)}
            </p>
            <button
              onClick={() => handleDownload(result.download_token)}
              style={{
                display: "block",
                width: "100%",
                background: BRAND,
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                padding: "0.75rem",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t.download_button}
            </button>
          </div>
        )}

        {/* Existing request status */}
        {!loading && authed && status && !result && (
          <>
            {status.latest && (
              <StatusCard
                request={status.latest}
                t={t}
                onDownload={handleDownload}
              />
            )}

            {!status.latest && (
              <p style={{ fontSize: "0.875rem", color: "#9CA3AF", marginBottom: "1.25rem" }}>
                {t.no_request_yet}
              </p>
            )}

            {/* Cooldown notice */}
            {!status.can_request && status.next_eligible_at && (
              <div
                style={{
                  background: "#FFF7ED",
                  border: "1px solid #FED7AA",
                  borderRadius: "10px",
                  padding: "0.75rem 1rem",
                  fontSize: "0.8125rem",
                  color: "#92400E",
                  marginBottom: "1rem",
                }}
              >
                {t.cooldown_notice} {t.cooldown_next} {fmt(status.next_eligible_at)}.
              </div>
            )}

            {status.can_request && (
              <button
                onClick={handleRequest}
                disabled={requesting}
                style={{
                  display: "block",
                  width: "100%",
                  background: requesting ? "#A78BFA" : BRAND,
                  color: "#fff",
                  border: "none",
                  borderRadius: "10px",
                  padding: "0.875rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  cursor: requesting ? "not-allowed" : "pointer",
                  marginTop: "0.5rem",
                }}
              >
                {requesting ? t.status_processing : t.request_button}
              </button>
            )}
          </>
        )}

        {/* Back link */}
        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <a
            href={`/${locale}`}
            style={{
              fontSize: "0.8125rem",
              color: "#9CA3AF",
              textDecoration: "none",
            }}
          >
            ← {locale === "ja" ? "戻る" : locale === "zh-TW" ? "返回" : "Back"}
          </a>
        </div>
      </div>
    </main>
  );
}

// ── StatusCard ────────────────────────────────────────────────────────────────

type StatusCardProps = {
  request: NonNullable<DsarStatus["latest"]>;
  t: ReturnType<typeof getMessages>["dsar"];
  onDownload: (token: string) => void;
};

function StatusCard({ request, t, onDownload }: StatusCardProps) {
  const statusLabel: Record<string, string> = {
    processing: t.status_processing,
    ready: t.status_ready,
    downloaded: t.status_downloaded,
    expired: t.status_expired,
    failed: t.error_generic,
  };

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    processing: { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE" },
    ready: { bg: "#F0FDF4", text: "#166534", border: "#BBF7D0" },
    downloaded: { bg: "#F9FAFB", text: "#6B7280", border: "#E5E7EB" },
    expired: { bg: "#FFF7ED", text: "#92400E", border: "#FED7AA" },
    failed: { bg: "#FEF2F2", text: "#991B1B", border: "#FECACA" },
  };

  const colors = statusColors[request.status] ?? statusColors.failed;

  return (
    <div
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: "12px",
        padding: "1rem 1.25rem",
        marginBottom: "1.25rem",
      }}
    >
      <p style={{ margin: "0 0 0.3rem", fontSize: "0.9rem", fontWeight: 600, color: colors.text }}>
        {statusLabel[request.status] ?? request.status}
      </p>
      <p style={{ margin: 0, fontSize: "0.78rem", color: "#6B7280" }}>
        {t.expires_label}: {fmt(request.expires_at)}
      </p>
      {request.status === "ready" && request.download_token && (
        <button
          onClick={() => onDownload(request.download_token!)}
          style={{
            display: "block",
            width: "100%",
            background: "#059669",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "0.7rem",
            fontSize: "0.9375rem",
            fontWeight: 600,
            cursor: "pointer",
            marginTop: "0.875rem",
          }}
        >
          {t.download_button}
        </button>
      )}
    </div>
  );
}
