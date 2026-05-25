import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { getMessages, isValidLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import VersionHistoryPanel from "@/components/version-history/VersionHistoryPanel";
import ApprovalModal from "@/components/version-history/ApprovalModal";
import ApprovalVersionBadge from "@/components/version-history/ApprovalVersionBadge";
import LineageAuditView from "@/components/version-history/LineageAuditView";
import type { ContentVersion, ContentApproval, AssetLineage } from "@/lib/version-types";

type Asset = {
  id: string;
  title: string;
  creator_id: string;
  created_at: string;
};

type AssetWithLineage = {
  asset: Asset;
  latestVersion: ContentVersion | null;
  latestApproval: ContentApproval | null;
  latestPostedVersionId: string | null;
  lineageLoaded: boolean;
};

const BRAND = "#7C3AED";

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`));
}

export default function CreatorDashboard() {
  const params = useParams<{ locale: string }>();
  const locale = isValidLocale(params.locale) ? params.locale : DEFAULT_LOCALE;
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetLineages, setAssetLineages] = useState<Record<string, AssetWithLineage>>({});
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [assetsError, setAssetsError] = useState<string | null>(null);
  const [expandedAsset, setExpandedAsset] = useState<string | null>(null);
  const [auditAsset, setAuditAsset] = useState<string | null>(null);
  const [approvalModal, setApprovalModal] = useState<{ assetId: string; version: ContentVersion } | null>(null);

  useEffect(() => {
    fetch("/api/assets")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Asset[]>;
      })
      .then((data) => {
        setAssets(data);
        data.forEach((a) => loadLineage(a));
      })
      .catch((err) => setAssetsError(err instanceof Error ? err.message : "Failed to load assets"))
      .finally(() => setLoadingAssets(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadLineage(asset: Asset) {
    fetch(`/api/assets/${asset.id}/lineage`)
      .then((r) => r.ok ? r.json() as Promise<AssetLineage> : Promise.reject())
      .then((lineage) => {
        const latestVersion = lineage.versions.at(-1) ?? null;
        const latestApproval = lineage.approvals.filter((a) => a.status === "approved").at(-1) ?? null;
        const latestPost = lineage.posts.at(-1);
        setAssetLineages((prev) => ({
          ...prev,
          [asset.id]: {
            asset,
            latestVersion,
            latestApproval,
            latestPostedVersionId: latestPost?.posted_version_id ?? null,
            lineageLoaded: true,
          },
        }));
      })
      .catch(() => {
        setAssetLineages((prev) => ({
          ...prev,
          [asset.id]: {
            asset,
            latestVersion: null,
            latestApproval: null,
            latestPostedVersionId: null,
            lineageLoaded: true,
          },
        }));
      });
  }

  if (auditAsset) {
    return (
      <LineageAuditView
        assetId={auditAsset}
        locale={locale}
        onBack={() => setAuditAsset(null)}
      />
    );
  }

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={h1Style}>Creator Dashboard</h1>
      </header>

      {loadingAssets && <p style={mutedStyle}>Loading assets…</p>}
      {!loadingAssets && assetsError && <p style={errorStyle}>{assetsError}</p>}

      {!loadingAssets && !assetsError && assets.length === 0 && (
        <p style={mutedStyle}>No assets found.</p>
      )}

      {!loadingAssets && assets.map((asset) => {
        const meta = assetLineages[asset.id];
        const latestVersion = meta?.latestVersion ?? null;
        const latestApproval = meta?.latestApproval ?? null;
        const latestPostedVersionId = meta?.latestPostedVersionId ?? null;
        const isMatch = latestApproval?.approved_version_id != null && latestPostedVersionId != null
          ? latestApproval.approved_version_id === latestPostedVersionId
          : null;

        return (
          <div key={asset.id} style={assetCardStyle}>
            <div style={assetHeaderStyle}>
              <div style={assetTitleRowStyle}>
                <span style={assetTitleStyle}>{asset.title ?? asset.id}</span>
                {latestVersion && isMatch !== null && (
                  <ApprovalVersionBadge
                    versionNum={latestVersion.version_num}
                    contentHash={latestVersion.content_hash}
                    isMatch={isMatch}
                    locale={locale}
                  />
                )}
              </div>

              <div style={assetActionsStyle}>
                {latestVersion && (
                  <button
                    style={secondaryBtnStyle}
                    onClick={() => setApprovalModal({ assetId: asset.id, version: latestVersion })}
                  >
                    Request approval
                  </button>
                )}
                <button
                  style={secondaryBtnStyle}
                  onClick={() => setAuditAsset(asset.id)}
                >
                  View lineage
                </button>
                <button
                  style={ghostBtnStyle}
                  onClick={() => setExpandedAsset(expandedAsset === asset.id ? null : asset.id)}
                >
                  {expandedAsset === asset.id ? "Hide history" : "Version history"}
                </button>
              </div>
            </div>

            {expandedAsset === asset.id && (
              <div style={{ marginTop: "1rem" }}>
                <VersionHistoryPanel
                  assetId={asset.id}
                  locale={locale}
                  approvedVersionId={latestApproval?.approved_version_id ?? null}
                  postedVersionId={latestPostedVersionId}
                />
              </div>
            )}
          </div>
        );
      })}

      {approvalModal && (
        <ApprovalModal
          assetId={approvalModal.assetId}
          version={approvalModal.version}
          isOpen={true}
          onClose={() => setApprovalModal(null)}
          onSubmitted={() => {
            const asset = assets.find((a) => a.id === approvalModal.assetId);
            setApprovalModal(null);
            if (asset) loadLineage(asset);
          }}
          locale={locale}
        />
      )}
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  fontFamily: "system-ui, -apple-system, 'Noto Sans CJK SC', 'Noto Sans CJK TC', 'Noto Sans JP', sans-serif",
  minHeight: "100vh",
  background: "#F9FAFB",
  padding: "1.5rem 1rem",
};

const headerStyle: React.CSSProperties = {
  maxWidth: "720px",
  margin: "0 auto 1.5rem",
};

const h1Style: React.CSSProperties = {
  fontSize: "1.5rem",
  fontWeight: 700,
  color: "#111827",
  margin: 0,
};

const mutedStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "#6B7280",
  maxWidth: "720px",
  margin: "0 auto",
};

const errorStyle: React.CSSProperties = {
  fontSize: "0.875rem",
  color: "#DC2626",
  maxWidth: "720px",
  margin: "0 auto",
};

const assetCardStyle: React.CSSProperties = {
  maxWidth: "720px",
  margin: "0 auto 1rem",
  background: "#fff",
  border: "1px solid #E5E7EB",
  borderRadius: "12px",
  padding: "1.25rem",
};

const assetHeaderStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: "0.75rem",
};

const assetTitleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const assetTitleStyle: React.CSSProperties = {
  fontSize: "1rem",
  fontWeight: 600,
  color: "#111827",
};

const assetActionsStyle: React.CSSProperties = {
  display: "flex",
  gap: "0.5rem",
  flexWrap: "wrap",
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: "0.4rem 0.875rem",
  background: BRAND,
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
};

const ghostBtnStyle: React.CSSProperties = {
  padding: "0.4rem 0.875rem",
  background: "#F3F4F6",
  color: "#374151",
  border: "1px solid #D1D5DB",
  borderRadius: "8px",
  fontSize: "0.8rem",
  fontWeight: 600,
  cursor: "pointer",
};
