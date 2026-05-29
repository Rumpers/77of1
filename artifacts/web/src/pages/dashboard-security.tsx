import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n";

const BRAND = "#7C3AED";
const FONT = `"Hiragino Kaku Gothic Pro", "Noto Sans CJK JP", system-ui, -apple-system, sans-serif`;

type Status = { enabled: boolean; recoveryCodesRemaining: number; enabledAt: string | null };
type SetupStep = "idle" | "scanning" | "verifying" | "recovery" | "done";
type DisableStep = "idle" | "confirm";

const T = {
  en: {
    title: "Account Security",
    subtitle: "Two-factor authentication (2FA)",
    status_enabled: "2FA is enabled",
    status_disabled: "2FA is not enabled",
    enabled_since: "Enabled since",
    recovery_codes: "Recovery codes remaining",
    enable_btn: "Enable 2FA",
    disable_btn: "Disable 2FA",
    payout_notice: "2FA is required before you can enable payouts.",
    setup_title: "Set up authenticator",
    setup_step1: "Tap the button below to open your authenticator app, or copy the key for manual setup.",
    setup_manual: "Or enter this key manually:",
    setup_step2: "Enter the 6-digit code from your app to confirm:",
    code_placeholder: "000000",
    verify_btn: "Verify and enable",
    verifying: "Verifying…",
    invalid_code: "Invalid code. Try again.",
    recovery_title: "Save your recovery codes",
    recovery_body: "Each code can be used once if you lose access to your authenticator. Store them somewhere safe.",
    recovery_warning: "These codes will not be shown again.",
    done_btn: "I've saved my codes",
    disable_title: "Disable 2FA",
    disable_body: "Enter your current 6-digit authenticator code (or a recovery code) to disable 2FA.",
    disable_btn_confirm: "Disable 2FA",
    disabling: "Disabling…",
    disabled_ok: "2FA has been disabled.",
    loading: "Loading…",
    error: "Something went wrong. Please try again.",
    cancel: "Cancel",
    copy: "Copy",
    copied: "Copied!",
    back_to_dashboard: "← Dashboard",
    open_authenticator: "Open in Authenticator app",
    desktop_hint: "On desktop: enter the key manually below instead.",
    hermes_hint: "You can also manage 2FA via Hermes on Telegram with /setup_2fa and /disable_2fa.",
  },
  ja: {
    title: "アカウントセキュリティ",
    subtitle: "二段階認証（2FA）",
    status_enabled: "2FAは有効です",
    status_disabled: "2FAは無効です",
    enabled_since: "有効化日",
    recovery_codes: "残りのリカバリーコード",
    enable_btn: "2FAを有効にする",
    disable_btn: "2FAを無効にする",
    payout_notice: "支払いを有効にする前に2FAが必要です。",
    setup_title: "認証アプリを設定",
    setup_step1: "下のボタンをタップして認証アプリを開くか、キーを手動で入力してください。",
    setup_manual: "または、このキーを手動で入力してください：",
    setup_step2: "アプリに表示される6桁のコードを入力して確認してください：",
    code_placeholder: "000000",
    verify_btn: "確認して有効にする",
    verifying: "確認中…",
    invalid_code: "無効なコードです。もう一度お試しください。",
    recovery_title: "リカバリーコードを保存",
    recovery_body: "認証アプリにアクセスできなくなった場合、各コードを1回使用できます。安全な場所に保管してください。",
    recovery_warning: "これらのコードは再表示されません。",
    done_btn: "コードを保存しました",
    disable_title: "2FAを無効にする",
    disable_body: "2FAを無効にするには、認証アプリの6桁のコード（またはリカバリーコード）を入力してください。",
    disable_btn_confirm: "2FAを無効にする",
    disabling: "無効化中…",
    disabled_ok: "2FAが無効になりました。",
    loading: "読み込み中…",
    error: "エラーが発生しました。もう一度お試しください。",
    cancel: "キャンセル",
    copy: "コピー",
    copied: "コピーしました！",
    back_to_dashboard: "← ダッシュボード",
    open_authenticator: "認証アプリで開く",
    desktop_hint: "PCの場合：下のキーを手動で入力してください。",
    hermes_hint: "HermesのTelegramで /setup_2fa や /disable_2fa を使って2FAを管理することもできます。",
  },
  "zh-TW": {
    title: "帳號安全",
    subtitle: "雙因素驗證（2FA）",
    status_enabled: "已啟用 2FA",
    status_disabled: "尚未啟用 2FA",
    enabled_since: "啟用日期",
    recovery_codes: "剩餘救援碼",
    enable_btn: "啟用 2FA",
    disable_btn: "停用 2FA",
    payout_notice: "啟用收款前必須先啟用 2FA。",
    setup_title: "設定驗證器",
    setup_step1: "點擊下方按鈕在驗證器應用程式中開啟，或手動輸入金鑰。",
    setup_manual: "或手動輸入此金鑰：",
    setup_step2: "輸入應用程式顯示的 6 位數驗證碼以確認：",
    code_placeholder: "000000",
    verify_btn: "驗證並啟用",
    verifying: "驗證中…",
    invalid_code: "驗證碼無效，請再試一次。",
    recovery_title: "儲存您的救援碼",
    recovery_body: "當您無法使用驗證器時，每個救援碼可使用一次。請將它們存放在安全的地方。",
    recovery_warning: "這些救援碼將不再顯示。",
    done_btn: "我已儲存救援碼",
    disable_title: "停用 2FA",
    disable_body: "輸入驗證器目前顯示的 6 位數驗證碼（或救援碼）以停用 2FA。",
    disable_btn_confirm: "停用 2FA",
    disabling: "停用中…",
    disabled_ok: "2FA 已停用。",
    loading: "載入中…",
    error: "發生錯誤，請重試。",
    cancel: "取消",
    copy: "複製",
    copied: "已複製！",
    back_to_dashboard: "← 儀表板",
    open_authenticator: "在驗證器應用程式中開啟",
    desktop_hint: "電腦版：請手動在下方輸入金鑰。",
    hermes_hint: "您也可以在 Telegram 的 Hermes 中使用 /setup_2fa 和 /disable_2fa 管理 2FA。",
  },
};

function getT(locale: string) {
  if (locale === "ja") return T.ja;
  if (locale === "zh-TW") return T["zh-TW"];
  return T.en;
}

export default function DashboardSecurity() {
  const params = useParams<{ locale: string }>();
  const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const t = getT(locale);

  const [status, setStatus] = useState<Status | null>(null);
  const [loadErr, setLoadErr] = useState(false);

  // Setup flow
  const [setupStep, setSetupStep] = useState<SetupStep>("idle");
  const [secretKey, setSecretKey] = useState("");
  const [otpauthUri, setOtpauthUri] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [setupErr, setSetupErr] = useState("");
  const [setupBusy, setSetupBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  // Disable flow
  const [disableStep, setDisableStep] = useState<DisableStep>("idle");
  const [disableCode, setDisableCode] = useState("");
  const [disableErr, setDisableErr] = useState("");
  const [disableBusy, setDisableBusy] = useState(false);

  async function loadStatus() {
    try {
      const res = await fetch("/api/auth/2fa/status");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStatus(data);
    } catch {
      setLoadErr(true);
    }
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function handleEnableBegin() {
    setSetupErr("");
    setSetupBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/setup/begin", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSetupErr(data.error ?? t.error);
        return;
      }
      setSecretKey(data.secretKey);
      setOtpauthUri(data.otpauthUri);
      setSetupStep("scanning");
    } catch {
      setSetupErr(t.error);
    } finally {
      setSetupBusy(false);
    }
  }

  async function handleVerify() {
    const normalized = setupCode.replace(/\s/g, "");
    if (normalized.length !== 6) return;
    setSetupErr("");
    setSetupBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/setup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSetupErr(data.error ?? t.invalid_code);
        return;
      }
      setRecoveryCodes(data.recoveryCodes);
      setSetupStep("recovery");
    } catch {
      setSetupErr(t.error);
    } finally {
      setSetupBusy(false);
    }
  }

  function handleRecoveryDone() {
    setSetupStep("idle");
    setSetupCode("");
    setRecoveryCodes([]);
    setQrDataUrl("");
    setSecretKey("");
    loadStatus();
  }

  function handleCopyRecoveryCodes() {
    navigator.clipboard.writeText(recoveryCodes.join("\n")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleDisable() {
    const normalized = disableCode.replace(/\s/g, "");
    if (!normalized) return;
    setDisableErr("");
    setDisableBusy(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDisableErr(data.error ?? t.error);
        return;
      }
      setDisableStep("idle");
      setDisableCode("");
      loadStatus();
    } catch {
      setDisableErr(t.error);
    } finally {
      setDisableBusy(false);
    }
  }

  const card: React.CSSProperties = {
    background: "#1a1a1a",
    borderRadius: "12px",
    padding: "1.25rem 1.5rem",
    marginBottom: "1rem",
    border: "1px solid #2a2a2a",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "0.75rem 1rem",
    borderRadius: "10px",
    border: "1px solid #333",
    background: "#111",
    color: "#f0f0f0",
    fontSize: "1.25rem",
    letterSpacing: "0.25em",
    textAlign: "center",
    fontFamily: "monospace",
    boxSizing: "border-box",
  };

  const btn = (active: boolean, danger = false): React.CSSProperties => ({
    padding: "0.8rem 1.25rem",
    borderRadius: "10px",
    border: "none",
    background: active ? (danger ? "#dc2626" : BRAND) : "#333",
    color: "#fff",
    fontFamily: FONT,
    fontSize: "0.9375rem",
    fontWeight: 600,
    cursor: active ? "pointer" : "not-allowed",
    opacity: active ? 1 : 0.6,
  });

  return (
    <main
      style={{
        maxWidth: "480px",
        margin: "0 auto",
        padding: "1.5rem 1.25rem 3rem",
        fontFamily: FONT,
        background: "#0f0f0f",
        color: "#f0f0f0",
        minHeight: "100dvh",
      }}
    >
      <a
        href={`/${locale}/dashboard`}
        style={{ display: "inline-block", color: "#888", fontSize: "0.875rem", marginBottom: "1.5rem", textDecoration: "none" }}
      >
        {t.back_to_dashboard}
      </a>

      <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.5rem", fontWeight: 700 }}>{t.title}</h1>
      <p style={{ margin: "0 0 2rem", color: "#aaa", fontSize: "0.9375rem" }}>{t.subtitle}</p>

      {/* Status card */}
      <div style={card}>
        {!status && !loadErr && (
          <p style={{ color: "#888", margin: 0 }}>{t.loading}</p>
        )}
        {loadErr && (
          <p style={{ color: "#f87171", margin: 0 }}>{t.error}</p>
        )}
        {status && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.25rem" }}>{status.enabled ? "🔐" : "🔓"}</span>
              <span style={{ fontWeight: 600, color: status.enabled ? "#4ade80" : "#f87171" }}>
                {status.enabled ? t.status_enabled : t.status_disabled}
              </span>
            </div>
            {status.enabled && (
              <>
                {status.enabledAt && (
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.8125rem", color: "#888" }}>
                    {t.enabled_since}: {new Date(status.enabledAt).toLocaleDateString(locale)}
                  </p>
                )}
                <p style={{ margin: 0, fontSize: "0.8125rem", color: "#888" }}>
                  {t.recovery_codes}: {status.recoveryCodesRemaining}/8
                </p>
              </>
            )}
            {!status.enabled && (
              <p style={{ margin: 0, fontSize: "0.8125rem", color: "#f59e0b" }}>{t.payout_notice}</p>
            )}
          </>
        )}
      </div>

      {/* Setup flow */}
      {status && !status.enabled && setupStep === "idle" && (
        <button
          onClick={handleEnableBegin}
          disabled={setupBusy}
          style={{ ...btn(!setupBusy), width: "100%", marginBottom: "1rem" }}
        >
          {setupBusy ? "…" : t.enable_btn}
        </button>
      )}

      {setupStep === "scanning" && (
        <div style={card}>
          <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", fontWeight: 600 }}>{t.setup_title}</h2>
          <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "#ccc" }}>{t.setup_step1}</p>

          {/* Deep link opens authenticator app on mobile */}
          <div style={{ textAlign: "center", marginBottom: "1.25rem" }}>
            <a
              href={otpauthUri}
              style={{
                display: "inline-block",
                padding: "0.75rem 1.5rem",
                background: BRAND,
                color: "#fff",
                borderRadius: "10px",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.9375rem",
                marginBottom: "0.5rem",
              }}
            >
              {t.open_authenticator}
            </a>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8125rem", color: "#666" }}>{t.desktop_hint}</p>
          </div>

          <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "#888" }}>{t.setup_manual}</p>
          <code
            style={{
              display: "block",
              background: "#111",
              padding: "0.5rem 0.75rem",
              borderRadius: "8px",
              fontSize: "0.875rem",
              letterSpacing: "0.1em",
              color: "#e0e0e0",
              marginBottom: "1.5rem",
              wordBreak: "break-all",
            }}
          >
            {secretKey}
          </code>

          <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "#ccc" }}>{t.setup_step2}</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={7}
            placeholder={t.code_placeholder}
            value={setupCode}
            onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            style={{ ...input, marginBottom: "1rem" }}
          />
          {setupErr && (
            <p style={{ color: "#f87171", fontSize: "0.875rem", margin: "0 0 0.75rem" }}>{setupErr}</p>
          )}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => { setSetupStep("idle"); setSetupCode(""); setSetupErr(""); }}
              style={{ ...btn(true), flex: "0 0 auto" }}
            >
              {t.cancel}
            </button>
            <button
              onClick={handleVerify}
              disabled={setupCode.length !== 6 || setupBusy}
              style={{ ...btn(setupCode.length === 6 && !setupBusy), flex: 1 }}
            >
              {setupBusy ? t.verifying : t.verify_btn}
            </button>
          </div>
        </div>
      )}

      {setupStep === "recovery" && (
        <div style={card}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 600 }}>{t.recovery_title}</h2>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#ccc" }}>{t.recovery_body}</p>
          <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#f59e0b", fontWeight: 600 }}>
            ⚠ {t.recovery_warning}
          </p>
          <div
            style={{
              background: "#111",
              borderRadius: "10px",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              color: "#e0e0e0",
              lineHeight: 2,
            }}
          >
            {recoveryCodes.map((code, i) => (
              <div key={i}>{code}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={handleCopyRecoveryCodes}
              style={{ ...btn(true), flex: "0 0 auto" }}
            >
              {copied ? t.copied : t.copy}
            </button>
            <button onClick={handleRecoveryDone} style={{ ...btn(true), flex: 1 }}>
              {t.done_btn}
            </button>
          </div>
        </div>
      )}

      {/* Disable flow */}
      {status?.enabled && disableStep === "idle" && setupStep === "idle" && (
        <button
          onClick={() => { setDisableStep("confirm"); setDisableCode(""); setDisableErr(""); }}
          style={{ ...btn(true, true), width: "100%", marginBottom: "1rem" }}
        >
          {t.disable_btn}
        </button>
      )}

      {disableStep === "confirm" && (
        <div style={card}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 600 }}>{t.disable_title}</h2>
          <p style={{ margin: "0 0 1rem", fontSize: "0.9rem", color: "#ccc" }}>{t.disable_body}</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={11}
            placeholder={t.code_placeholder}
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.replace(/[^0-9A-Fa-f-]/g, ""))}
            style={{ ...input, marginBottom: "1rem" }}
          />
          {disableErr && (
            <p style={{ color: "#f87171", fontSize: "0.875rem", margin: "0 0 0.75rem" }}>{disableErr}</p>
          )}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              onClick={() => { setDisableStep("idle"); setDisableCode(""); setDisableErr(""); }}
              style={{ ...btn(true), flex: "0 0 auto" }}
            >
              {t.cancel}
            </button>
            <button
              onClick={handleDisable}
              disabled={!disableCode || disableBusy}
              style={{ ...btn(!!disableCode && !disableBusy, true), flex: 1 }}
            >
              {disableBusy ? t.disabling : t.disable_btn_confirm}
            </button>
          </div>
        </div>
      )}

      {/* Hermes hint */}
      <div
        style={{
          background: "#1a1a2e",
          borderRadius: "10px",
          padding: "0.875rem 1rem",
          marginTop: "1.5rem",
          borderLeft: `3px solid ${BRAND}`,
        }}
      >
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "#b0b0d0", lineHeight: 1.5 }}>
          {t.hermes_hint}
        </p>
      </div>
    </main>
  );
}
