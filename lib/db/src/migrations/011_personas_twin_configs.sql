-- 011_personas_twin_configs.sql
-- [OFA-11] Creator persona setup API (OFA-7)
-- Stores the 7-field persona config, intensity dial, and kill switch.

-- personas: one row per creator persona snapshot.
-- A creator can have only one active persona at a time (enforced via twin_configs FK).
CREATE TABLE IF NOT EXISTS personas (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id        TEXT        NOT NULL,

  -- Field 1: Greeting style (e.g. "Hey babe!", "Welcome, darling")
  greeting_style    TEXT        NOT NULL DEFAULT '',

  -- Field 2: Fan terms of endearment (e.g. "babe", "darling", "fan")
  fan_endearment    TEXT        NOT NULL DEFAULT 'fan',

  -- Field 3: Emoji usage
  emoji_usage       TEXT        NOT NULL DEFAULT 'minimal'
                                CHECK (emoji_usage IN ('none', 'minimal', 'moderate', 'heavy')),

  -- Field 4: Hard stops / forbidden topics (JSON array of strings)
  hard_stops        JSONB       NOT NULL DEFAULT '[]'::jsonb,

  -- Field 5: Treatment style (e.g. "warm and encouraging", "flirty", "formal")
  treatment_style   TEXT        NOT NULL DEFAULT '',

  -- Field 6: Personality traits (JSON array of strings)
  personality_traits JSONB      NOT NULL DEFAULT '[]'::jsonb,

  -- Field 7: Message style (e.g. "short and punchy", "detailed", "poetic")
  message_style     TEXT        NOT NULL DEFAULT '',

  -- Intensity dial: creator-set ceiling for response intimacy
  intensity_level   TEXT        NOT NULL DEFAULT 'warm'
                                CHECK (intensity_level IN ('warm', 'intimate', 'explicit')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personas_creator_id ON personas (creator_id);

-- twin_configs: one row per creator; kill switch + active persona reference.
CREATE TABLE IF NOT EXISTS twin_configs (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id                TEXT        NOT NULL UNIQUE,

  -- FK to the active persona snapshot
  persona_id                UUID        REFERENCES personas (id) ON DELETE SET NULL,

  -- Kill switch: when true twin responses are paused immediately
  kill_switch               BOOLEAN     NOT NULL DEFAULT false,
  kill_switch_activated_at  TIMESTAMPTZ,

  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_twin_configs_creator_id ON twin_configs (creator_id);
CREATE INDEX IF NOT EXISTS idx_twin_configs_persona_id ON twin_configs (persona_id);
