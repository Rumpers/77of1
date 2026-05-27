-- Admin DB migration 003: add DELETION_VERIFY to audit_action enum
-- [HID-013] Data-deletion verification tooling — OF-227
-- §8.3: every staff action on deletion records must be signed and retained.

-- Postgres enums require ALTER TYPE to add values; cannot be inside a transaction
-- block that also modifies the column, so we use a DO block with a guard.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'DELETION_VERIFY'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action')
  ) THEN
    ALTER TYPE audit_action ADD VALUE 'DELETION_VERIFY';
  END IF;
END $$;
