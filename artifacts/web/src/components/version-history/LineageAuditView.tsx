import { useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n";
import type { AssetLineage, ContentVersion } from "@/lib/version-types";

interface Props {
  assetId: string;
  locale?: string;
  onBack: () => void;
}

type TimelineEvent =
  | { kind: "draft"; version: ContentVersion }
  | { kind: "approved"; version: ContentVersion; approvalId: string }
  | { kind: "posted"; version: ContentVersion; postId: string; postedAt: string };

const BRAND = "#7C3AED";
const GREEN = "#059669";
const AMBER = "#D97706";
const RED = "#DC2626";

function interpolate(template: string, vars: Record<string, string | number | null>): string {
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

function buildTimeline(lineage: AssetLineage): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const versionMap = new Map(lineage.versions.map((v) => [v.id, v]));

  for (const ver of lineage.versions) {
    events.push({ kind: "draft", version: ver });
  }

  for (const approval of lineage.approvals) {
    if (approval.status === "approved" && approval.approved_version_id) {
      const ver = versionMap.get(approval.approved_version_id);
      if (ver) events.push({ kind: "approved", version: ver, approvalId: approval.id });
    }
  }

  for (const post of lineage.posts) {
    if (post.posted_version_id) {
      const ver = versionMap.get(post.posted_version_id);
      if (ver) events.push({ kind: "posted", version: ver, postId: post.id, postedAt: post.posted_at });
    }
  }

  return events;
}

function detectMismatch(lineage: AssetLineage): { hasMismatch: boolean; approvedNum: number | null; postedNum: number | null } {
  const versionMap = new Map(lineage.versions.map((v) => [v.id, v]));
  const latestApproval = lineage.approvals.filter((a) => a.status === "approved").slice(-1)[0];
  const latestPost = lineage.posts.slice(-1)[0];
  if (!latestApproval || !latestPost) return { hasMismatch: false, approvedNum: null, postedNum: null };

  const approvedVer = latestApproval.approved_version_id
    ? versionMap.get(latestApproval.approved_version_id)
    : null;
  const postedVer = latestPost.posted_version_id
    ? versionMap.get(latestPost.posted_version_id)
    : null;

  const hasMismatch = !!(approvedVer && postedVer && approvedVer.id !== postedVer.id);
  return {
    hasMismatch,
    approvedNum: approvedVer?.version_num ?? null,
    postedNum: postedVer?.version_num ?? null,
  };
}

export default function LineageAuditView({ assetId, locale = "en", onBack }: Props) {
  const t = getMessages(locale).version_history;
  const [lineage, setLineage] = useState<AssetLineage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/assets/${assetId}/lineage`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<AssetLineage>;
      })
      .then((data) => {
        if (!cancelled) setLineage(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : t.audit_error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [assetId, t.audit_error]);

  return (
    <div style={viewStyle}>
      <button style={backBtnStyle} onClick={onBack}>
        {t.audit_back}
      </button>

      <h2 style={titleStyle}>{t.audit_title}</h2>

      {loading && <p style={mutedStyle}>{t.audit_loading}</p>}
      {!loading && error && <p style={errorStyle}>{error}</p>}

      {!loading && !error && lineage && (() => {
        if (lineage.versions.length === 0) {
          return <p style={mutedStyle}>{t.audit_no_data}</p>;
        }

        const { hasMismatch, approvedNum, postedNum } = detectMismatch(lineage);
        const events = buildTimeline(lineage);

        return (
          <>
            {hasMismatch && (
              <div style={mismatchBannerStyle}>
                <span style={{ fontSize: "1.1rem" }}>⚠️</span>
                <span>
                  {interpolate(t.audit_mismatch_banner, {
                    posted: postedNum ?? "?",
                    approved: approvedNum ?? "?",
                  })}
                </span>
              </div>
            )}

            <ol style={timelineListStyle}>
              {events.map((event, idx) => (
                <li key={`${event.kind}-${event.kind === "draft" ? event.version.id : idx}`} style={timelineItemStyle}>
                  <div style={dotColStyle}>
                    <div style={eventDotStyle(event.kind)} />
                    {idx < events.length - 1 && <div style={lineStyle} />}
                  </div>

                  <div style={eventContentStyle}>
                    <span style={eventLabelStyle(event.kind)}>
                      {event.kind === "draft" && interpolate(t.audit_draft, { n: event.version.version_num })}
                      {event.kind === "approved" && interpolate(t.audit_approved, { n: event.version.version_num })}
                      {event.kind === "posted" && interpolate(t.audit_posted, { n: event.version.version_num })}
                    </span>
                    <span style={hashStyle}>
                      {event.version.content_hash.slice(0, 7)}
                    </span>
                    <span style={timestampStyle}>
                      {event.kind === "posted"
                        ? formatDate(event.postedAt)
                        : formatDate(event.version.created_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </>
        );
      })()}
    </div>
  );
}

function eventDotStyle(kind: TimelineEvent["kind"]): React.CSSProperties {
  const colors: Record<typeof kind, string> = {
    draft: "#9CA3AF",
    approved: GREEN,
    posted: BRAND,
  };
  return {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: colors[kind],
    flexShrink: 0,
  };
}

function eventLabelStyle(kind: TimelineEvent["kind"]): React.CSSProperties {
  const colors: Record<typeof kind, string> = {
    draft: "#374151",
    approved: GREEN,
    posted: BRAND,
  };
  return {
    fontSize: "0.875rem",
    fontWeight: 700,
    color: colors[kind],
  };
}

const viewStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, 'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans JP', sans-serif",
  minHeight: "100vh",
  background: "#F9FAFB",
  padding: "1.5rem 1rem",
  maxWidth: "600px",
  margin: "0 auto",
};

const backBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  padding: "0 0 1rem",
  cursor: "pointer",
  fontSize: "0.875rem",
  color: BRAND,
  fontWeight: 600,
  textDecoration: "none",
  display: "block",
};

const titleStyle: React.CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  color: "#111827",
  margin: "0 0 1.25rem",
};

const mutedStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "#6B7280",
};

const errorStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: RED,
};

const mismatchBannerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "0.5rem",
  background: "#FEF3C7",
  border: "1px solid #FCD34D",
  borderRadius: "10px",
  padding: "0.875rem",
  marginBottom: "1.25rem",
  fontSize: "0.875rem",
  color: AMBER,
  fontWeight: 600,
  lineHeight: 1.5,
};

const timelineListStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
};

const timelineItemStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.875rem",
  alignItems: "flex-start",
};

const dotColStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  flexShrink: 0,
  paddingTop: "2px",
};

const lineStyle: React.CSSProperties = {
  width: "2px",
  flexGrow: 1,
  minHeight: "28px",
  background: "#E5E7EB",
  margin: "2px 0",
};

const eventContentStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.5rem",
  paddingBottom: "1.25rem",
};

const hashStyle: React.CSSProperties = {
  fontSize: "0.7rem",
  fontFamily: "monospace",
  color: "#9CA3AF",
  background: "#F3F4F6",
  padding: "0.15rem 0.4rem",
  borderRadius: "4px",
};

const timestampStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#9CA3AF",
};
