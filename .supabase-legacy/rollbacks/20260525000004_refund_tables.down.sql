-- Rollback: HID-011-A refund tables (OF-182)

drop trigger if exists refund_request_updated_at on refund_requests;
drop trigger if exists refund_request_set_sla on refund_requests;
drop function if exists trg_refund_request_updated_at();
drop function if exists trg_refund_request_set_sla();

drop table if exists refund_decisions;
drop table if exists refund_requests;
drop table if exists staff_users;

drop type if exists refund_reason_code;
drop type if exists refund_decision_outcome;
drop type if exists refund_status;
drop type if exists refund_inbound_channel;
drop type if exists refund_reason_category;
