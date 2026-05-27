import { useState, useEffect } from "react";
import {
  needsBanner,
  acceptAll,
  rejectAll,
  saveConsent,
  onConsentChange,
  type ConsentPreferences,
} from "@/lib/cookie-consent";

// ── i18n strings ─────────────────────────────────────────────────────────────

type Locale = "en" | "ja" | "zh-TW";

const STRINGS: Record<Locale, {
  title: string;
  body: string;
  accept_all: string;
  reject_all: string;
  customise: string;
  save: string;
  cancel: string;
  necessary_label: string;
  necessary_desc: string;
  analytics_label: string;
  analytics_desc: string;
  marketing_label: string;
  marketing_desc: string;
  always_on: string;
  policy_link: string;
}> = {
  en: {
    title: "Cookie settings",
    body: "We use cookies to keep the app working and, with your permission, to understand how it's used and show you relevant content.",
    accept_all: "Accept all",
    reject_all: "Necessary only",
    customise: "Customise",
    save: "Save choices",
    cancel: "Back",
    necessary_label: "Necessary",
    necessary_desc: "Required for the app to function. Always on.",
    analytics_label: "Analytics",
    analytics_desc: "Helps us understand how fans use the app (PostHog). No ad targeting.",
    marketing_label: "Marketing",
    marketing_desc: "Measures ad campaign performance (Google Analytics 4).",
    always_on: "Always on",
    policy_link: "Privacy policy",
  },
  ja: {
    title: "Cookieの設定",
    body: "アプリの動作に必要なCookieを使用しています。ご同意いただければ、利用状況の把握や関連コンテンツの表示にも使用します。",
    accept_all: "すべて許可",
    reject_all: "必要なもののみ",
    customise: "カスタマイズ",
    save: "設定を保存",
    cancel: "戻る",
    necessary_label: "必須",
    necessary_desc: "アプリの動作に必要です。常にオンです。",
    analytics_label: "分析",
    analytics_desc: "ファンのアプリ利用状況を把握するのに役立ちます（PostHog）。広告ターゲティングなし。",
    marketing_label: "マーケティング",
    marketing_desc: "広告キャンペーンの効果測定に使用します（Google Analytics 4）。",
    always_on: "常にオン",
    policy_link: "プライバシーポリシー",
  },
  "zh-TW": {
    title: "Cookie 設定",
    body: "我們使用 Cookie 維持應用程式運作，並在您同意的情況下，了解使用方式並顯示相關內容。",
    accept_all: "全部接受",
    reject_all: "僅必要",
    customise: "自訂",
    save: "儲存選擇",
    cancel: "返回",
    necessary_label: "必要",
    necessary_desc: "應用程式運作所需，永遠開啟。",
    analytics_label: "分析",
    analytics_desc: "協助我們了解粉絲如何使用應用程式（PostHog）。不用於廣告定向。",
    marketing_label: "行銷",
    marketing_desc: "衡量廣告活動成效（Google Analytics 4）。",
    always_on: "永遠開啟",
    policy_link: "隱私政策",
  },
};

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  locale?: string;
}

export default function CookieConsentBanner({ locale = "en" }: Props) {
  const t = STRINGS[(locale as Locale) in STRINGS ? (locale as Locale) : "en"];

  const [visible, setVisible] = useState(needsBanner);
  const [showCustomise, setShowCustomise] = useState(false);
  const [prefs, setPrefs] = useState<Omit<ConsentPreferences, "necessary">>({
    analytics: false,
    marketing: false,
  });

  // Re-sync if another tab updated consent
  useEffect(() => {
    return onConsentChange((s) => {
      if (s.decided) setVisible(false);
    });
  }, []);

  if (!visible) return null;

  function handleAcceptAll() {
    acceptAll();
    setVisible(false);
  }

  function handleRejectAll() {
    rejectAll();
    setVisible(false);
  }

  function handleSave() {
    saveConsent(prefs);
    setVisible(false);
  }

  const overlay: React.CSSProperties = {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    display: "flex",
    justifyContent: "center",
    pointerEvents: "none",
  };

  const sheet: React.CSSProperties = {
    pointerEvents: "auto",
    background: "#1a1a1a",
    borderTop: "1px solid #2a2a2a",
    borderRadius: "16px 16px 0 0",
    width: "100%",
    maxWidth: "480px",
    padding: "1.25rem 1.25rem 2rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.875rem",
    boxShadow: "0 -4px 24px rgba(0,0,0,0.5)",
  };

  const btnPrimary: React.CSSProperties = {
    flex: 1,
    background: "#7c3aed",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    padding: "0.75rem 1rem",
    fontSize: "0.9375rem",
    fontWeight: 600,
    cursor: "pointer",
  };

  const btnSecondary: React.CSSProperties = {
    flex: 1,
    background: "transparent",
    color: "#aaa",
    border: "1px solid #333",
    borderRadius: "10px",
    padding: "0.75rem 1rem",
    fontSize: "0.9375rem",
    fontWeight: 500,
    cursor: "pointer",
  };

  const btnGhost: React.CSSProperties = {
    background: "transparent",
    color: "#777",
    border: "none",
    fontSize: "0.875rem",
    cursor: "pointer",
    padding: "0.25rem 0",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  };

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label={t.title}>
      <div style={sheet}>
        {/* Drag handle */}
        <div
          style={{
            width: "36px",
            height: "4px",
            background: "#444",
            borderRadius: "2px",
            alignSelf: "center",
            marginBottom: "0.25rem",
          }}
        />

        <p style={{ margin: 0, fontWeight: 700, fontSize: "1rem", color: "#f0f0f0" }}>
          {t.title}
        </p>

        {!showCustomise ? (
          <>
            <p style={{ margin: 0, fontSize: "0.8125rem", color: "#999", lineHeight: 1.5 }}>
              {t.body}
            </p>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button style={btnPrimary} onClick={handleAcceptAll}>
                {t.accept_all}
              </button>
              <button style={btnSecondary} onClick={handleRejectAll}>
                {t.reject_all}
              </button>
            </div>

            <button style={{ ...btnGhost, alignSelf: "center" }} onClick={() => setShowCustomise(true)}>
              {t.customise}
            </button>
          </>
        ) : (
          <>
            {/* Category rows */}
            <CategoryRow
              label={t.necessary_label}
              desc={t.necessary_desc}
              locked
              lockedLabel={t.always_on}
              value={true}
              onChange={() => {}}
            />
            <CategoryRow
              label={t.analytics_label}
              desc={t.analytics_desc}
              value={prefs.analytics}
              onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
            />
            <CategoryRow
              label={t.marketing_label}
              desc={t.marketing_desc}
              value={prefs.marketing}
              onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
            />

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button style={btnSecondary} onClick={() => setShowCustomise(false)}>
                {t.cancel}
              </button>
              <button style={btnPrimary} onClick={handleSave}>
                {t.save}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── CategoryRow ───────────────────────────────────────────────────────────────

interface CategoryRowProps {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
  lockedLabel?: string;
}

function CategoryRow({ label, desc, value, onChange, locked, lockedLabel }: CategoryRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        padding: "0.625rem 0",
        borderBottom: "1px solid #2a2a2a",
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: "0 0 0.2rem", fontSize: "0.875rem", fontWeight: 600, color: "#e0e0e0" }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: "0.75rem", color: "#777", lineHeight: 1.45 }}>
          {desc}
        </p>
      </div>

      {locked ? (
        <span style={{ fontSize: "0.75rem", color: "#555", flexShrink: 0, paddingTop: "0.125rem" }}>
          {lockedLabel}
        </span>
      ) : (
        <Toggle value={value} onChange={onChange} />
      )}
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ value, onChange }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: "44px",
        height: "24px",
        borderRadius: "12px",
        border: "none",
        background: value ? "#7c3aed" : "#333",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 0.15s",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: value ? "23px" : "3px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "#fff",
          transition: "left 0.15s",
        }}
      />
    </button>
  );
}
