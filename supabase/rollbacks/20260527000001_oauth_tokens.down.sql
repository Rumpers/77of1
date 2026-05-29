-- Rollback for 20260527000001_oauth_tokens.sql (HID-069)

drop trigger if exists creator_oauth_tokens_updated_at on creator_oauth_tokens;
drop function if exists set_updated_at();
drop table if exists creator_oauth_tokens;
