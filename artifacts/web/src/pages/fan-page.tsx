import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { useParams } from "wouter";
import { getCreatorConfig } from "@/lib/creator-fixtures";
import { getMessages, isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import { sendFanOtp, verifyFanOtp } from "@/lib/auth";

// ── helpers ──────────────────────────────────────────────────────────────────

function isWebview(): boolean {
  const ua = navigator.userAgent;
  return /Instagram|ByteDance|TikTok|FBAN|FBAV/i.test(ua);
}

function trialKey(handle: string): string {
  return `7of1_trial_${handle}`;
}

function getTrialCount(handle: string): number {
  try {
    return parseInt(sessionStorage.getItem(trialKey(handle)) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function setTrialCount(handle: string, n: number): void {
  try {
    sessionStorage.setItem(trialKey(handle), String(n));
  } catch {
    // sessionStorage unavailable (private browsing, webview sandbox)
  }
}

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

type LocaleKey = "en" | "ja" | "zh-TW";

function disclosureFooter(locale: string, handle: string): string {
  const map: Record<LocaleKey, string> = {
    en: `AI twin · @${handle}_ai`,
    ja: `AIツイン · @${handle}_ai`,
    "zh-TW": `AI分身 · @${handle}_ai`,
  };
  return map[(locale as LocaleKey)] ?? map.en;
}

// ── types ─────────────────────────────────────────────────────────────────────

type ChatMessage = {
  id: string;
  role: "fan" | "ai";
  text: string;
  pending?: boolean;
};

// ── component ─────────────────────────────────────────────────────────────────

export default function FanPage() {
  const params = useParams<{ locale: string; handle: string }>();
  const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const handle = params.handle ?? "";

  const config = getCreatorConfig(handle);
  const t = getMessages(locale).fan;

  // CSS vars for brand colour
  useLayoutEffect(() => {
    const style = document.createElement("style");
    style.id = "creator-css-vars";
    style.textContent = `:root{--brand:${config.brand_color};--brand-font-weight:${config.font_weight};}`;
    document.head.appendChild(style);
    return () => style.remove();
  }, [config.brand_color, config.font_weight]);

  // AI disclosure banner (auto-dismiss after 3s)
  const [bannerVisible, setBannerVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setBannerVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sending, setSending] = useState(false);
  const [trialCount, setTrialCountState] = useState(() => getTrialCount(handle));
  const [showPaywall, setShowPaywall] = useState(false);
  const MAX_TRIAL = 3;

  // OTP auth state (shown inside paywall after trial exhausted)
  type OtpStep = "email" | "code" | "done";
  const [otpStep, setOtpStep] = useState<OtpStep>("email");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [fanAuthenticated, setFanAuthenticated] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = inputValue.trim();
    if (!text || sending) return;

    // Block if trial exhausted
    if (trialCount >= MAX_TRIAL) {
      setShowPaywall(true);
      return;
    }

    const fanMsg: ChatMessage = {
      id: `fan-${Date.now()}`,
      role: "fan",
      text,
    };
    const pendingMsg: ChatMessage = {
      id: `ai-pending-${Date.now()}`,
      role: "ai",
      text: "…",
      pending: true,
    };

    setMessages((prev) => [...prev, fanMsg, pendingMsg]);
    setInputValue("");
    setSending(true);

    try {
      const res = await fetch("/api/twin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, handle, locale }),
      });

      let aiText = "";
      if (res.ok) {
        const data = await res.json();
        aiText = data.text ?? "…";
      } else {
        aiText = "Sorry, I couldn't respond right now. Try again soon!";
      }

      const newCount = trialCount + 1;
      setTrialCount(handle, newCount);
      setTrialCountState(newCount);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "ai",
        text: aiText,
      };

      setMessages((prev) => prev.filter((m) => !m.pending).concat(aiMsg));

      // Show paywall after 3rd AI response
      if (newCount >= MAX_TRIAL) {
        setTimeout(() => setShowPaywall(true), 600);
      }
    } catch {
      setMessages((prev) =>
        prev
          .filter((m) => !m.pending)
          .concat({
            id: `ai-err-${Date.now()}`,
            role: "ai",
            text: "Connection issue. Please try again.",
          })
      );
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function handleOtpSend() {
    if (!otpEmail.includes("@") || otpBusy) return;
    setOtpBusy(true);
    setOtpError("");
    const { error } = await sendFanOtp(otpEmail);
    setOtpBusy(false);
    if (error) { setOtpError(error); return; }
    setOtpStep("code");
  }

  async function handleOtpVerify() {
    if (otpCode.length < 6 || otpBusy) return;
    setOtpBusy(true);
    setOtpError("");
    const { fanId, error } = await verifyFanOtp(otpEmail, otpCode, handle);
    setOtpBusy(false);
    if (error) { setOtpError(t.otp_error_invalid); return; }
    if (fanId) {
      setOtpStep("done");
      setFanAuthenticated(true);
      setTimeout(() => setShowPaywall(false), 800);
    }
  }

  const remaining = MAX_TRIAL - trialCount;
  // Authenticated fans bypass the trial gate.
  const trialExhausted = !fanAuthenticated && trialCount >= MAX_TRIAL;

  const CJK_FONT = `"Hiragino Kaku Gothic Pro", "Noto Sans CJK JP", "Microsoft JhengHei", system-ui, sans-serif`;
  const fontFamily = locale === "en" ? "system-ui, -apple-system, sans-serif" : CJK_FONT;

  return (
    <main
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        fontFamily,
        display: "flex",
        flexDirection: "column",
        minHeight: "100dvh",
        background: "#0f0f0f",
        color: "#f0f0f0",
        position: "relative",
      }}
    >
      {/* AI Disclosure Banner */}
      {bannerVisible && (
        <div
          onClick={() => setBannerVisible(false)}
          style={{
            background: "#1a1a2e",
            color: "#e0e0ff",
            fontSize: "0.8125rem",
            textAlign: "center",
            padding: "0.5rem 1rem",
            cursor: "pointer",
            userSelect: "none",
            borderBottom: "1px solid #2a2a4a",
            zIndex: 20,
          }}
        >
          {t.disclosure_banner}
        </div>
      )}

      {/* Cover image + hero */}
      <div style={{ flexShrink: 0 }}>
        <img
          src={config.cover_image_url}
          alt={handle}
          style={{ width: "100%", display: "block", maxHeight: "200px", objectFit: "cover" }}
          loading="eager"
        />
        <div style={{ padding: "1rem 1.25rem 0.75rem" }}>
          <h1
            style={{
              color: config.brand_color,
              fontWeight: config.font_weight,
              margin: "0 0 0.25rem",
              fontSize: "1.375rem",
            }}
          >
            @{handle}
          </h1>
          <p style={{ margin: 0, color: "#aaa", fontSize: "0.875rem" }}>
            Chat with @{handle}'s AI twin — available 24/7
          </p>
        </div>
      </div>

      {/* Chat thread */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem 1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.875rem",
        }}
      >
        {messages.length === 0 && (
          <p
            style={{
              textAlign: "center",
              color: "#555",
              fontSize: "0.8125rem",
              marginTop: "2rem",
            }}
          >
            {interpolate(t.chat_placeholder, { handle })}
          </p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: msg.role === "fan" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "0.625rem 0.875rem",
                borderRadius: msg.role === "fan" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                background: msg.role === "fan" ? config.brand_color : "#2a2a2a",
                color: msg.role === "fan" ? "#fff" : "#e8e8e8",
                fontSize: "0.9375rem",
                lineHeight: 1.45,
                opacity: msg.pending ? 0.6 : 1,
              }}
            >
              {msg.text}
            </div>
            {msg.role === "ai" && !msg.pending && (
              <span
                style={{
                  fontSize: "0.6875rem",
                  color: "#555",
                  marginTop: "0.25rem",
                  paddingLeft: "0.25rem",
                }}
              >
                {disclosureFooter(locale, handle)}
              </span>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Trial counter */}
      {!trialExhausted && messages.length > 0 && (
        <div
          style={{
            textAlign: "center",
            fontSize: "0.75rem",
            color: "#666",
            padding: "0.25rem 0",
          }}
        >
          {interpolate(t.trial_remaining, { n: remaining })}
        </div>
      )}
      {trialExhausted && !showPaywall && (
        <div
          style={{
            textAlign: "center",
            fontSize: "0.75rem",
            color: "#888",
            padding: "0.25rem 0",
            cursor: "pointer",
          }}
          onClick={() => setShowPaywall(true)}
        >
          {t.trial_exhausted} · {t.paywall_title}
        </div>
      )}

      {/* Message input */}
      <div
        style={{
          padding: "0.75rem 1rem",
          borderTop: "1px solid #222",
          display: "flex",
          gap: "0.5rem",
          alignItems: "flex-end",
          background: "#0f0f0f",
          flexShrink: 0,
        }}
      >
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={interpolate(t.chat_placeholder, { handle })}
          disabled={sending || trialExhausted}
          rows={1}
          style={{
            flex: 1,
            background: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "10px",
            color: "#f0f0f0",
            padding: "0.625rem 0.75rem",
            fontSize: "0.9375rem",
            fontFamily,
            resize: "none",
            outline: "none",
            lineHeight: 1.4,
            maxHeight: "6rem",
            overflowY: "auto",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={sending || !inputValue.trim() || trialExhausted}
          style={{
            background: config.brand_color,
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "0.625rem 1rem",
            fontSize: "0.9375rem",
            fontWeight: 600,
            cursor: sending || !inputValue.trim() || trialExhausted ? "not-allowed" : "pointer",
            opacity: sending || !inputValue.trim() || trialExhausted ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          {t.send}
        </button>
      </div>

      {/* Paywall modal */}
      {showPaywall && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 50,
          }}
        >
          <div
            style={{
              background: "#161616",
              borderRadius: "20px 20px 0 0",
              padding: "2rem 1.5rem 2.5rem",
              width: "100%",
              maxWidth: "480px",
              display: "flex",
              flexDirection: "column",
              gap: "0.875rem",
            }}
          >
            {/* Handle bar */}
            <div
              style={{
                width: "40px",
                height: "4px",
                background: "#444",
                borderRadius: "2px",
                alignSelf: "center",
                marginBottom: "0.5rem",
              }}
            />

            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#f0f0f0" }}>
              {t.paywall_title}
            </h2>

            <p style={{ margin: 0, fontSize: "0.875rem", color: "#888" }}>
              {t.trial_exhausted}
            </p>

            {/* Subscribe button */}
            <a
              href="#subscribe"
              style={{
                display: "block",
                background: config.brand_color,
                color: "#fff",
                padding: "0.875rem 1rem",
                borderRadius: "12px",
                textDecoration: "none",
                textAlign: "center",
                fontWeight: 700,
                fontSize: "1rem",
              }}
            >
              {t.paywall_subscribe}
            </a>

            {/* Buy credits button */}
            <a
              href="#credits"
              style={{
                display: "block",
                background: "transparent",
                color: config.brand_color,
                border: `2px solid ${config.brand_color}`,
                padding: "0.75rem 1rem",
                borderRadius: "12px",
                textDecoration: "none",
                textAlign: "center",
                fontWeight: 600,
                fontSize: "1rem",
              }}
            >
              {t.paywall_credits}
            </a>

            {/* Open in browser escape */}
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block",
                textAlign: "center",
                fontSize: "0.875rem",
                color: "#666",
                textDecoration: "none",
                padding: "0.25rem 0",
              }}
            >
              {isWebview() ? t.paywall_escape : t.paywall_escape}
            </a>

            {/* Supabase email OTP — webview-safe, no OAuth popup */}
            <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: "0.875rem", marginTop: "0.25rem" }}>
              {otpStep === "done" ? (
                <p style={{ textAlign: "center", color: "#4ade80", fontSize: "0.9rem", margin: 0 }}>
                  ✓ {t.paywall_signup_cta}
                </p>
              ) : otpStep === "email" ? (
                <>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.8125rem", color: "#888", textAlign: "center" }}>
                    {t.otp_title}
                  </p>
                  <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", color: "#666", textAlign: "center" }}>
                    {t.otp_subtitle}
                  </p>
                  <input
                    type="email"
                    value={otpEmail}
                    onChange={(e) => setOtpEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleOtpSend()}
                    placeholder={t.otp_email_placeholder}
                    autoComplete="email"
                    inputMode="email"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "#1a1a1a", border: "1px solid #333",
                      borderRadius: "10px", color: "#f0f0f0",
                      padding: "0.625rem 0.75rem", fontSize: "0.9375rem",
                      marginBottom: "0.5rem", outline: "none",
                    }}
                  />
                  {otpError && <p style={{ color: "#f87171", fontSize: "0.75rem", margin: "0 0 0.5rem", textAlign: "center" }}>{otpError}</p>}
                  <button
                    onClick={handleOtpSend}
                    disabled={otpBusy || !otpEmail.includes("@")}
                    style={{
                      width: "100%", background: config.brand_color, color: "#fff",
                      border: "none", borderRadius: "10px", padding: "0.75rem",
                      fontSize: "0.9375rem", fontWeight: 600,
                      cursor: otpBusy || !otpEmail.includes("@") ? "not-allowed" : "pointer",
                      opacity: otpBusy || !otpEmail.includes("@") ? 0.5 : 1,
                    }}
                  >
                    {otpBusy ? t.otp_sending : t.otp_send_button}
                  </button>
                </>
              ) : (
                <>
                  <p style={{ margin: "0 0 0.625rem", fontSize: "0.8125rem", color: "#888", textAlign: "center" }}>
                    {t.otp_check_email}
                  </p>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    onKeyDown={(e) => e.key === "Enter" && handleOtpVerify()}
                    placeholder={t.otp_code_placeholder}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "#1a1a1a", border: "1px solid #333",
                      borderRadius: "10px", color: "#f0f0f0",
                      padding: "0.625rem 0.75rem", fontSize: "1.25rem",
                      letterSpacing: "0.25em", textAlign: "center",
                      marginBottom: "0.5rem", outline: "none",
                    }}
                  />
                  {otpError && <p style={{ color: "#f87171", fontSize: "0.75rem", margin: "0 0 0.5rem", textAlign: "center" }}>{otpError}</p>}
                  <button
                    onClick={handleOtpVerify}
                    disabled={otpBusy || otpCode.length < 6}
                    style={{
                      width: "100%", background: config.brand_color, color: "#fff",
                      border: "none", borderRadius: "10px", padding: "0.75rem",
                      fontSize: "0.9375rem", fontWeight: 600,
                      cursor: otpBusy || otpCode.length < 6 ? "not-allowed" : "pointer",
                      opacity: otpBusy || otpCode.length < 6 ? 0.5 : 1,
                      marginBottom: "0.5rem",
                    }}
                  >
                    {otpBusy ? t.otp_verifying : t.otp_verify_button}
                  </button>
                  <button
                    onClick={() => { setOtpStep("email"); setOtpCode(""); setOtpError(""); }}
                    style={{
                      background: "transparent", border: "none", color: "#666",
                      fontSize: "0.8125rem", cursor: "pointer",
                      padding: "0.25rem 0", width: "100%", textAlign: "center",
                    }}
                  >
                    {t.otp_back}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
