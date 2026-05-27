-- Rollback: HID-062 creator tax forms (OF-283)

drop trigger if exists creator_tax_forms_updated_at on creator_tax_forms;
drop function if exists update_creator_tax_forms_updated_at();
drop function if exists check_payout_tax_eligible(uuid);
drop table if exists creator_tax_forms;
