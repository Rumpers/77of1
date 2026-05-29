-- HID-056: Creator timezone + language preferences
-- Adds timezone and hermes_language to creator_config.
-- timezone  : IANA tz string (e.g. 'Asia/Tokyo', 'America/New_York'); default UTC.
-- hermes_language: language Hermes uses when messaging the creator; default 'en'.

alter table creator_config
  add column if not exists timezone         text not null default 'UTC',
  add column if not exists hermes_language  text not null default 'en'
    check (hermes_language in ('en', 'ja', 'zh-tw'));
