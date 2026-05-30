-- 014_twins_voice_id.sql
-- Phase 3: Voice Hardening — twins.voice_id column (plan 03-06 / VOICE-01)
--
-- Stores the creator's cloned MiniMax voice_id returned by registerVoiceClone()
-- (clone Step A). NULL until clone registration completes; the voice-generation
-- worker falls back to GMI_TTS_FALLBACK_VOICE_ID when voice_id is NULL so the
-- synth path is testable before clone onboarding runs.
--
-- [DEPLOYMENT NOTE]: Run `pnpm --filter @workspace/db run push` (or apply via
-- supabase db push) before starting the voice-generation worker. The worker
-- selects twins.voice_id at job execution time; missing column = worker crash.

ALTER TABLE twins ADD COLUMN IF NOT EXISTS voice_id TEXT;

-- No index needed: voice_id is read via `WHERE id = $1` on the twins PK.
