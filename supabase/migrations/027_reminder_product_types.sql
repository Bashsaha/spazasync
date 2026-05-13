-- Extend `compliance_reminders.reminder_type` CHECK enum with two new types
-- introduced by the inventory-cluster smart-reminders pass:
--   * products_missing_cost     — fires weekly when 1+ products have NULL cost_price
--   * products_missing_supplier — fires weekly when 1+ products have NULL supplier_id
--                                 (suppressed entirely when the shop has 0 suppliers)
--
-- Both are independent reminders (per product requirements). The evaluator gates
-- and bucketing live in `src/lib/compliance/reminders.ts`.

ALTER TABLE compliance_reminders DROP CONSTRAINT IF EXISTS compliance_reminders_reminder_type_check;

ALTER TABLE compliance_reminders ADD CONSTRAINT compliance_reminders_reminder_type_check
  CHECK (reminder_type IN (
    'coa_expiry',
    'permit_expiry',
    'cipc_annual',
    'visa_expiry',
    'journey_nudge',
    'fund_nudge',
    'fund_qualified',
    'score_drop',
    'checklist_streak',
    'admin_alert',
    'products_missing_cost',
    'products_missing_supplier'
  ));
