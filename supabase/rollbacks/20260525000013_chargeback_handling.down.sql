-- Rollback for 20260525000013_chargeback_handling.sql

-- Remove feature flag
delete from feature_flags where key = 'chargeback_auto_ban_threshold';

-- Remove credit_transactions kind constraint (restore original)
alter table credit_transactions
  drop constraint if exists credit_transactions_kind_check;
alter table credit_transactions
  add constraint credit_transactions_kind_check
    check (kind in ('topup', 'spend', 'refund'));

-- Remove columns added to existing tables
alter table creator_ledger_entries
  drop column if exists chargeback_dispute_id;

alter table fans
  drop column if exists chargeback_count;

-- Drop new tables (order respects FK deps)
drop table if exists chargeback_auto_bans;
drop table if exists chargeback_evidence;
drop table if exists chargeback_disputes;

-- Drop trigger and function
drop trigger if exists chargeback_dispute_defaults on chargeback_disputes;
drop function if exists trg_chargeback_dispute_defaults();

-- Drop enum types
-- Note: payment_tx_status 'chargebacked' value cannot be removed once added in PG.
-- Full rollback requires recreating the enum type without it if needed.
drop type if exists chargeback_status;
