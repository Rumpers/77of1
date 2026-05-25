import { useState } from "react";
import { getMessages } from "@/lib/i18n";
import type { ContentVersion, ContentApproval } from "@/lib/version-types";

interface Props {
  assetId: string;
  version: ContentVersion;
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (approval: ContentApproval) => void;
  locale?: string;
}

const BRAND = "#7C3AED";
const BRAND_LIGHT = "#F5F3FF";

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export default function ApprovalModal({ assetId, version, isOpen, onClose, onSubmitted, locale = "en" }: Props) {
  const t = getMessages(locale).version_history;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleConfirm() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId, versionId: version.id }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const approval = (await res.json()) as ContentApproval;
      onSubmitted(approval);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.modal_error);
    } finally {
      setLoading(false);
    }
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div style={backdropStyle} onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <div style={modalStyle}>
        <h2 style={modalTitleStyle}>{t.modal_title}</h2>

        <div style={warningBoxStyle}>
          <span style={warningIconStyle}>⚠️</span>
          <p style={warningTextStyle}>
            {interpolate(t.modal_version_warning, { n: version.version_num })}
          </p>
        </div>

        <p style={hashLabelStyle}>
          {interpolate(t.modal_hash_label, { hash: version.content_hash })}
        </p>

        {error && <p style={errorStyle}>{error}</p>}

        <div style={buttonRowStyle}>
          <button
            style={{ ...cancelBtnStyle }}
            onClick={onClose}
            disabled={loading}
          >
            {t.modal_cancel}
          </button>
          <button
            style={{ ...confirmBtnStyle, opacity: loading ? 0.65 : 1 }}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? t.modal_submitting : t.modal_confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
  zIndex: 100,
};

const modalStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, 'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans JP', sans-serif",
  background: "#fff",
  borderRadius: "16px",
  padding: "1.5rem",
  width: "100%",
  maxWidth: "440px",
  boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
};

const modalTitleStyle: React.CSSProperties = {
  fontSize: "1.15rem",
  fontWeight: 700,
  color: "#111827",
  margin: "0 0 1rem",
};

const warningBoxStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "flex-start",
  background: BRAND_LIGHT,
  border: `1px solid ${BRAND}33`,
  borderRadius: "10px",
  padding: "0.875rem",
  marginBottom: "0.875rem",
};

const warningIconStyle: React.CSSProperties = {
  fontSize: "1.1rem",
  lineHeight: 1,
  flexShrink: 0,
};

const warningTextStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "#374151",
  margin: 0,
  lineHeight: 1.55,
};

const hashLabelStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontFamily: "monospace",
  color: "#6B7280",
  padding: "0.5rem 0.75rem",
  background: "#F9FAFB",
  borderRadius: "6px",
  wordBreak: "break-all",
  marginBottom: "1rem",
};

const errorStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "#DC2626",
  marginBottom: "0.75rem",
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
};

const cancelBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "0.75rem",
  background: "#F3F4F6",
  color: "#374151",
  border: "1.5px solid #D1D5DB",
  borderRadius: "10px",
  fontSize: "0.95rem",
  fontWeight: 600,
  cursor: "pointer",
};

const confirmBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: "0.75rem",
  background: BRAND,
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  fontSize: "0.95rem",
  fontWeight: 700,
  cursor: "pointer",
};
