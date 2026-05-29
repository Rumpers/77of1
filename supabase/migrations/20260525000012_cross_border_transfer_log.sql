-- [HID-037] Cross-border transfer logging — OF-260
-- APPI (JP) / PDPA (TW) §8.11: every cross-border transfer of personal data to an
-- AI provider must record lawful basis, data category, source/dest region, and volume.
-- Used for annual compliance reports and audit evidence.
--
-- Populated by the provider adapter layer (ITextProvider / IVoiceProvider / IVideoProvider)
-- each time a call containing PII is dispatched to an external provider.

CREATE TABLE IF NOT EXISTS cross_border_transfer_log (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link back to the generation job that triggered the transfer.
  -- NULL for transfers outside the job pipeline (e.g., RAG indexing, asset upload).
  generation_job_id UUID        REFERENCES generation_jobs(id) ON DELETE SET NULL,

  -- Creator whose data was transferred. Required for RLS-scoped reads and annual reports.
  creator_id        UUID        NOT NULL REFERENCES creators(id) ON DELETE CASCADE,

  -- Which AI provider received the data (e.g. 'openai', 'elevenlabs', 'runway', 'anthropic').
  provider_name     TEXT        NOT NULL,

  -- ISO 3166-1 alpha-2 country code where PII originated (platform data residency).
  -- Typically 'JP' or 'TW' for the initial markets; 'HK' added at Day-2 launch.
  source_region     TEXT        NOT NULL,

  -- Country code of the provider's processing endpoint.
  -- Derived from provider docs (e.g. OpenAI = 'US', ElevenLabs = 'US', etc.).
  dest_region       TEXT        NOT NULL,

  -- APPI / PDPA lawful basis for the cross-border transfer.
  lawful_basis      TEXT        NOT NULL
                      CHECK (lawful_basis IN (
                        'contractual_necessity',  -- necessary to perform the creator/fan contract
                        'consent',                -- explicit data-subject consent on file
                        'legitimate_interests',   -- platform's legitimate interests documented
                        'adequacy_decision'       -- dest country has adequate protection ruling
                      )),

  -- Category of personal data transferred.
  data_category     TEXT        NOT NULL
                      CHECK (data_category IN (
                        'text_content',         -- fan messages, generated text
                        'voice_biometric',      -- voice samples / voice-clone audio
                        'video_content',        -- face / body video generation
                        'image_content',        -- profile images, generated stills
                        'personal_identifiers'  -- names, IDs, account metadata
                      )),

  -- Number of data subjects (or discrete records) in this transfer.
  -- Typically 1 per job; batch ingest jobs may transfer multiple.
  record_count      INT         NOT NULL DEFAULT 1 CHECK (record_count > 0),

  -- Wall-clock time the provider call was dispatched. Index anchor for annual reports.
  transferred_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Annual compliance report support index.
-- Covers the GROUP BY in cross_border_transfer_annual_report for per-creator queries.
-- transferred_at DESC allows efficient year-range scans without a functional expression.
CREATE INDEX IF NOT EXISTS xb_log_annual_report_idx
  ON cross_border_transfer_log (
    creator_id,
    provider_name,
    source_region,
    dest_region,
    lawful_basis,
    data_category,
    transferred_at DESC
  );

-- Chronological lookup per creator (compliance review, DSAR).
CREATE INDEX IF NOT EXISTS xb_log_creator_time_idx
  ON cross_border_transfer_log (creator_id, transferred_at DESC);

-- Link to generation job for job-level provenance queries.
CREATE INDEX IF NOT EXISTS xb_log_job_idx
  ON cross_border_transfer_log (generation_job_id)
  WHERE generation_job_id IS NOT NULL;

-- Provider + destination for provider-change impact analysis.
CREATE INDEX IF NOT EXISTS xb_log_provider_dest_idx
  ON cross_border_transfer_log (provider_name, dest_region, transferred_at DESC);

ALTER TABLE cross_border_transfer_log ENABLE ROW LEVEL SECURITY;

-- Creators see only their own transfer records.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cross_border_transfer_log'
      AND policyname = 'xb_log_creator_select'
  ) THEN
    CREATE POLICY xb_log_creator_select ON cross_border_transfer_log
      FOR SELECT
      USING (creator_id = current_setting('app.current_creator_id', true)::uuid);
  END IF;
END $$;

-- Server-side (service role) inserts only — no client-originated writes.
-- Service role bypasses RLS; no insert policy needed.

-- Annual compliance report view.
-- Aggregates transfer volume by year × provider × regions × lawful_basis × data_category.
-- Staff export this via the admin panel for APPI/PDPA annual submissions.
CREATE OR REPLACE VIEW cross_border_transfer_annual_report AS
  SELECT
    date_trunc('year', transferred_at)::DATE AS transfer_year,
    creator_id,
    provider_name,
    source_region,
    dest_region,
    lawful_basis,
    data_category,
    SUM(record_count)::BIGINT               AS total_record_count,
    COUNT(*)::BIGINT                        AS transfer_event_count,
    MIN(transferred_at)                     AS first_transfer_at,
    MAX(transferred_at)                     AS last_transfer_at
  FROM cross_border_transfer_log
  GROUP BY 1, 2, 3, 4, 5, 6, 7;

COMMENT ON TABLE cross_border_transfer_log IS
  'APPI/PDPA §8.11 — per-call record of every cross-border PII transfer to an AI provider. '
  'Written by provider adapter layer on each outbound call containing personal data.';

COMMENT ON VIEW cross_border_transfer_annual_report IS
  'Annual compliance roll-up for APPI/PDPA cross-border transfer reporting. '
  'Aggregate exported by admin panel for regulatory submissions.';
