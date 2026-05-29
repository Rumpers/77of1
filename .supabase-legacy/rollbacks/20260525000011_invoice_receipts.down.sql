-- Rollback: HID-023 Invoice / receipt generation — OF-248

drop table if exists invoice_number_seq;
drop table if exists creator_monthly_statements;
drop table if exists invoices;

drop function if exists next_invoice_number(uuid, int);
drop function if exists set_invoice_retain_until();
drop function if exists touch_invoices();
drop function if exists touch_creator_monthly_statements();

drop type if exists invoice_status;
drop type if exists invoice_kind;

delete from feature_flags where key = 'invoice_generation_enabled';
