import { useEffect, useState, useLayoutEffect } from "react";
import { useParams } from "wouter";
import { getCreatorConfig } from "@/lib/creator-fixtures";
import { getSession, type SessionState } from "@/lib/auth";
import { getMessages, isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n";

export default function FanPage() {
  const params = useParams<{ locale: string; handle: string }>();
  const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const handle = params.handle ?? "";

  const config = getCreatorConfig(handle);
  const t = getMessages(locale).fan;

  const [session, setSession] = useState<SessionState | null>(null);

  useLayoutEffect(() => {
    const style = document.createElement("style");
    style.id = "creator-css-vars";
    style.textContent = `:root{--brand:${config.brand_color};--brand-font-weight:${config.font_weight};}`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [config.brand_color, config.font_weight]);

  useEffect(() => {
    getSession().then(setSession);
  }, []);

  const authCallback = `/${locale}/${handle}`;

  return (
    <main
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        padding: "1.5rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <img
        src={config.cover_image_url}
        alt={handle}
        style={{ width: "100%", borderRadius: "12px", marginBottom: "1.25rem" }}
      />

      <h1
        style={{
          color: "var(--brand)",
          fontWeight: "var(--brand-font-weight)",
          margin: "0 0 0.5rem",
          fontSize: "1.5rem",
        }}
      >
        @{handle}
      </h1>

      {session === null ? (
        <p style={{ color: "#999", fontSize: "0.9rem" }}>{t.loading}</p>
      ) : session.authenticated && session.user ? (
        <p style={{ color: "#555", fontSize: "0.9rem" }}>
          Welcome back, {session.user.name}
        </p>
      ) : (
        <div
          style={{
            marginTop: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <a
            href={`/_replit/auth?callback=${encodeURIComponent(authCallback)}`}
            style={{
              display: "block",
              background: "var(--brand)",
              color: "#fff",
              padding: "0.875rem 1.5rem",
              borderRadius: "10px",
              textDecoration: "none",
              textAlign: "center",
              fontWeight: 600,
              fontSize: "1rem",
            }}
          >
            {t.free_trial}
          </a>
          <p
            style={{
              textAlign: "center",
              fontSize: "0.8125rem",
              color: "#999",
              margin: 0,
            }}
          >
            {t.send_message}
          </p>
        </div>
      )}

      <p
        style={{
          marginTop: "3rem",
          textAlign: "center",
          fontSize: "0.75rem",
          color: "#ccc",
        }}
      >
        {t.powered_by}
      </p>
    </main>
  );
}
