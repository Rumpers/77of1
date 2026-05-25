import { useState } from "react";
import { useParams } from "wouter";
import { getMessages, isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n";

const CJK_FONT = `"Hiragino Kaku Gothic Pro", "Noto Sans CJK JP", "Microsoft JhengHei", system-ui, sans-serif`;

type Mode = "fan" | "creator";
type Step = "form" | "done";

const CONTAINER: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  background: "#0f0f0f",
  color: "#f0f0f0",
};

const CARD: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#1a1a1a",
  borderRadius: 16,
  padding: "2rem 1.75rem",
  boxShadow: "0 4px 32px rgba(0,0,0,0.5)",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  background: "#111",
  border: "1.5px solid #333",
  borderRadius: 8,
  color: "#f0f0f0",
  fontSize: 15,
  padding: "0.65rem 0.9rem",
  outline: "none",
  boxSizing: "border-box",
};

const BTN_PRIMARY: React.CSSProperties = {
  width: "100%",
  background: "#7C3AED",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "0.75rem 1rem",
  fontSize: 15,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: "1.25rem",
};

const BTN_DISABLED: React.CSSProperties = {
  ...BTN_PRIMARY,
  background: "#3a2a5e",
  cursor: "not-allowed",
  opacity: 0.6,
};

const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  color: "#a0a0a0",
  marginBottom: 6,
  marginTop: "1rem",
};

const ERROR_BOX: React.CSSProperties = {
  background: "#3a1515",
  border: "1px solid #7f2020",
  borderRadius: 8,
  color: "#f87171",
  padding: "0.6rem 0.9rem",
  fontSize: 13,
  marginTop: "0.75rem",
};

const TAB_ROW: React.CSSProperties = {
  display: "flex",
  gap: 4,
  background: "#111",
  borderRadius: 10,
  padding: 4,
  marginBottom: "1.5rem",
};

function Tab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "0.45rem 0.5rem",
        borderRadius: 7,
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        background: active ? "#7C3AED" : "transparent",
        color: active ? "#fff" : "#888",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function FanDsar() {
  const params = useParams<{ locale: string }>();
  const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const t = getMessages(locale).dsar;
  const fontFamily = locale === "en" ? "system-ui, -apple-system, sans-serif" : CJK_FONT;

  const [mode, setMode] = useState<Mode>("fan");
  const [step, setStep] = useState<Step>("form");

  // Form state
  const [email, setEmail] = useState("");
  const [requestType, setRequestType] = useState<"all" | "messages" | "account">("all");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailValid = isValidEmail(email);
  const canSubmit = emailValid && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dsar/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          requestType: mode === "fan" ? requestType : "creator_export",
          role: mode,
          locale,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json as { error?: string }).error ?? t.error_generic);
        return;
      }
      setStep("done");
    } catch {
      setError(t.error_generic);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ ...CONTAINER, fontFamily }}>
      <div style={CARD}>
        {step === "form" && (
          <>
            <div style={TAB_ROW}>
              <Tab
                active={mode === "fan"}
                label={t.fan_tab}
                onClick={() => { setMode("fan"); setError(null); }}
              />
              <Tab
                active={mode === "creator"}
                label={t.creator_tab}
                onClick={() => { setMode("creator"); setError(null); }}
              />
            </div>

            {mode === "fan" ? (
              <>
                <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                  {t.fan_title}
                </h1>
                <p style={{ fontSize: 14, color: "#888", marginBottom: "0.25rem" }}>
                  {t.fan_subtitle}
                </p>

                <label style={LABEL}>{t.email_label}</label>
                <input
                  style={INPUT}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.email_placeholder}
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                />

                <label style={LABEL}>{t.request_type_label}</label>
                <select
                  style={{ ...INPUT, appearance: "none" as const }}
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value as typeof requestType)}
                >
                  <option value="all">{t.request_type_all}</option>
                  <option value="messages">{t.request_type_messages}</option>
                  <option value="account">{t.request_type_account}</option>
                </select>

                <p style={{ fontSize: 12, color: "#555", marginTop: "0.75rem", lineHeight: 1.5 }}>
                  {t.fan_notice}
                </p>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>
                  {t.creator_title}
                </h1>
                <p style={{ fontSize: 14, color: "#888", marginBottom: "0.25rem" }}>
                  {t.creator_subtitle}
                </p>

                <label style={LABEL}>{t.creator_email_label}</label>
                <input
                  style={INPUT}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.email_placeholder}
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                />

                <p style={{ fontSize: 12, color: "#555", marginTop: "0.75rem", lineHeight: 1.5 }}>
                  {t.creator_notice}
                </p>
              </>
            )}

            {!emailValid && email.length > 0 && (
              <p style={{ fontSize: 12, color: "#f87171", marginTop: "0.4rem" }}>
                {t.email_invalid}
              </p>
            )}

            {error && <div style={ERROR_BOX}>{error}</div>}

            <button
              style={canSubmit ? BTN_PRIMARY : BTN_DISABLED}
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              {submitting
                ? t.submitting
                : mode === "fan"
                ? t.fan_submit
                : t.creator_submit}
            </button>
          </>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: "0.75rem" }}>✅</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
              {t.done_title}
            </h1>
            <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6 }}>
              {mode === "fan"
                ? t.done_body_fan.replace("{email}", email.trim())
                : t.done_body_creator.replace("{email}", email.trim())}
            </p>
            <p style={{ fontSize: 12, color: "#555", marginTop: "1rem" }}>
              {t.done_support_hint}
            </p>
          </div>
        )}
      </div>

      <p style={{ marginTop: "1.25rem", color: "#555", fontSize: 12, textAlign: "center" }}>
        {t.powered_by}
      </p>
    </div>
  );
}
