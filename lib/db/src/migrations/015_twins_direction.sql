-- Migration 015: add direction column to twins table
-- Applied by: pnpm --filter @workspace/db run push (requires DATABASE_URL on Replit)
ALTER TABLE twins ADD COLUMN IF NOT EXISTS direction TEXT;
