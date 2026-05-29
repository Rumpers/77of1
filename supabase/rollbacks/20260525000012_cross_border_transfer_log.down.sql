-- Rollback: [HID-037] Cross-border transfer logging
-- Drops the view, table, and all associated indexes/policies.

DROP VIEW IF EXISTS cross_border_transfer_annual_report;
DROP TABLE IF EXISTS cross_border_transfer_log;
