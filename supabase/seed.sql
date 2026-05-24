-- 7of1 local dev seed data
-- Run via: supabase db reset  (applies migrations then this file)

-- Seed a test creator
insert into creators (id, handle, display_name, config) values
  (
    '00000000-0000-0000-0000-000000000001',
    'test-creator',
    'Test Creator',
    '{"intensity_dial": "warm", "languages_served": ["en"], "monetization_model": "subscription"}'
  )
on conflict (id) do nothing;

-- Seed consent grants for all modalities (text + voice for dev)
insert into consent_grants (creator_id, modality, version) values
  ('00000000-0000-0000-0000-000000000001', 'text',  1),
  ('00000000-0000-0000-0000-000000000001', 'voice', 1)
on conflict (creator_id, modality, version) do nothing;

-- Seed a test fan linked to test-creator
insert into fans (id, creator_id, locale, tier, age_verified) values
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'en',
    'subscriber',
    true
  )
on conflict (id) do nothing;

-- Seed initial credit balance for test fan
insert into fan_credits (fan_id, creator_id, balance) values
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    100
  )
on conflict (fan_id, creator_id) do nothing;

-- Seed usage counter for current billing period
insert into usage_counters (fan_id, creator_id, billing_period) values
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    to_char(now(), 'YYYY-MM')
  )
on conflict (fan_id, creator_id, billing_period) do nothing;
