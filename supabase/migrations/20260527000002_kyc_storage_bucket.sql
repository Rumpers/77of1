-- KYC document storage bucket  (HID-062)
-- Private bucket for identity docs and tax forms.
-- Access only via service_role key (server-side); creators never get direct URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kyc-docs',
  'kyc-docs',
  false,
  10485760,   -- 10 MB max per file
  array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do nothing;

-- No public RLS policy: the bucket is private.
-- All reads/writes go through the service_role key in API server routes.
-- Creators upload via a short-lived signed upload URL obtained server-side.
