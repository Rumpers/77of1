// Types matching Supabase snake_case column names returned by /api/assets/:assetId/versions
// and /api/assets/:assetId/lineage endpoints (OF-165).

export interface ContentVersion {
  id: string;
  asset_id: string;
  version_num: number;
  content_hash: string;
  body_snapshot: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
}

export interface ContentApproval {
  id: string;
  asset_id: string;
  approved_version_id: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_id: string | null;
  requested_by: string;
  notes: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface PostedContent {
  id: string;
  asset_id: string;
  posted_version_id: string | null;
  posted_at: string;
  platform_channel_id: string;
}

export interface AssetLineage {
  versions: ContentVersion[];
  approvals: ContentApproval[];
  posts: PostedContent[];
}
