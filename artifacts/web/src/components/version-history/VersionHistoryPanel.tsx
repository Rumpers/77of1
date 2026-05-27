import { useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n";
import type { ContentVersion } from "@/lib/version-types";
import ApprovalVersionBadge from "./ApprovalVersionBadge";

interface Props {
  assetId: string;
  locale?: string;
  approvedVersionId?: string | null;
  postedVersionId?: string | null;
}

type ExpandedMap = Record<string, boolean>;

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

const BRAND = "#7C3AED";

export default function VersionHistoryPanel({ assetId, locale = "en", approvedVersionId, postedVersionId }: Props) {
  const t = getMessages(locale).version_history;
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedMap>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/assets/${assetId}/versions`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<ContentVersion[]>;
      })
      .then((data) => {
        if (!cancelled) setVersions(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t.error_load);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [assetId, t.error_load]);

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div style={panelStyle}>
      <h3 style={titleStyle}>{t.panel_title}</h3>

      {loading && <p style={mutedStyle}>{t.loading}</p>}
      {!loading && error && <p style={errorStyle}>{error}</p>}
      {!loading && !error && versions.length === 0 && (
        <p style={mutedStyle}>{t.no_versions}</p>
      )}

      {!loading && !error && versions.length > 0 && (
        <ol style={timelineStyle}>
          {versions.map((v, idx) => {
            const isLatest = idx === versions.length - 1;
            const isExpandedItem = expanded[v.id] ?? false;
            const approvedMatch = approvedVersionId != null && postedVersionId != null
              ? approvedVersionId === postedVersionId
              : null;

            return (
              <li key={v.id} style={timelineItemStyle}>
                <div style={dotColStyle}>
                  <div style={dotStyle(isLatest)} />
                  {idx < versions.length - 1 && <div style={lineStyle} />}
                </div>

                <div style={itemContentStyle}>
                  <div style={itemHeaderStyle}>
                    <span style={vNumStyle}>
                      {interpolate(t.version_label, { n: v.version_num })}
                    </span>
                    {v.created_at && (
                      <span style={mutedSmallStyle}>{formatDate(v.created_at)}</span>
                    )}
                    {v.created_by && (
                      <span style={mutedSmallStyle}>
                        {interpolate(t.by_label, { author: v.created_by })}
                      </span>
                    )}
                    {approvedVersionId === v.id && approvedMatch !== null && (
                      <ApprovalVersionBadge
                        versionNum={v.version_num}
                        contentHash={v.content_hash}
                        isMatch={approvedMatch}
                        locale={locale}
                      />
                    )}
                  </div>

                  <div style={hashRowStyle}>
                    <span style={hashStyle}>
                      {interpolate(t.hash_label, { hash: v.content_hash.slice(0, 7) })}
                    </span>
                    <button style={expandBtnStyle} onClick={() => toggleExpand(v.id)}>
                      {isExpandedItem ? t.collapse_snapshot : t.expand_snapshot}
                    </button>
                  </div>

                  {isExpandedItem && (
                    <pre style={snapshotStyle}>
                      {JSON.stringify(v.body_snapshot, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, 'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans JP', sans-serif",
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: "12px",
  padding: "1.25rem",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 700,
  color: "#111827",
  margin: "0 0 1rem",
};

const mutedStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "#6B7280",
  margin: 0,
};

const mutedSmallStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#9CA3AF",
};

const errorStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "#DC2626",
  margin: 0,
};

const timelineStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 0,
};

const timelineItemStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "flex-start",
};

const dotColStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  flexShrink: 0,
  paddingTop: "3px",
};

function dotStyle(isLatest: boolean): React.CSSProperties {
  return {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: isLatest ? BRAND : "#D1D5DB",
    border: `2px solid ${isLatest ? BRAND : "#9CA3AF"}`,
    flexShrink: 0,
  };
}

const lineStyle: React.CSSProperties = {
  width: "2px",
  flexGrow: 1,
  minHeight: "24px",
  background: "#E5E7EB",
  margin: "2px 0",
};

const itemContentStyle: React.CSSProperties = {
  flex: 1,
  paddingBottom: "1rem",
};

const itemHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "0.5rem",
  marginBottom: "0.25rem",
};

const vNumStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  fontWeight: 700,
  color: "#111827",
};

const hashRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
};

const hashStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  fontFamily: "monospace",
  color: "#6B7280",
};

const expandBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
  fontSize: "0.75rem",
  color: BRAND,
  textDecoration: "underline",
  fontWeight: 500,
};

const snapshotStyle: React.CSSProperties = {
  marginTop: "0.5rem",
  padding: "0.75rem",
  background: "#F9FAFB",
  border: "1px solid #E5E7EB",
  borderRadius: "8px",
  fontSize: "0.7rem",
  fontFamily: "monospace",
  overflowX: "auto",
  whiteSpace: "pre-wrap",
  wordBreak: "break-all",
  color: "#374151",
  maxHeight: "240px",
  overflow: "auto",
};
