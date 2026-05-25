import { useState } from "react";
import { getMessages } from "@/lib/i18n";

interface Props {
  versionNum: number;
  contentHash: string;
  isMatch: boolean;
  locale?: string;
}

const GREEN = "#059669";
const AMBER = "#D97706";

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export default function ApprovalVersionBadge({ versionNum, contentHash, isMatch, locale = "en" }: Props) {
  const t = getMessages(locale).version_history;
  const [showTooltip, setShowTooltip] = useState(false);
  const shortHash = contentHash.slice(0, 7);
  const label = interpolate(t.version_label, { n: versionNum }) + " · " + interpolate(t.hash_label, { hash: shortHash });

  return (
    <span
      style={badgeStyle(isMatch)}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="status"
      aria-label={isMatch ? t.badge_tooltip_match : t.badge_tooltip_mismatch}
    >
      {label}
      {showTooltip && (
        <span style={tooltipStyle}>
          {isMatch ? t.badge_tooltip_match : t.badge_tooltip_mismatch}
        </span>
      )}
    </span>
  );
}

function badgeStyle(isMatch: boolean): React.CSSProperties {
  return {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    padding: "0.2rem 0.55rem",
    borderRadius: "9999px",
    fontSize: "0.75rem",
    fontWeight: 600,
    fontFamily: "system-ui, -apple-system, 'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans JP', sans-serif",
    background: isMatch ? "#D1FAE5" : "#FEF3C7",
    color: isMatch ? GREEN : AMBER,
    border: `1px solid ${isMatch ? "#6EE7B7" : "#FCD34D"}`,
    cursor: "default",
    userSelect: "none",
    whiteSpace: "nowrap",
  };
}

const tooltipStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "calc(100% + 6px)",
  left: "50%",
  transform: "translateX(-50%)",
  background: "#1F2937",
  color: "#F9FAFB",
  padding: "0.4rem 0.65rem",
  borderRadius: "6px",
  fontSize: "0.75rem",
  fontWeight: 400,
  whiteSpace: "nowrap",
  zIndex: 50,
  pointerEvents: "none",
  boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
};
