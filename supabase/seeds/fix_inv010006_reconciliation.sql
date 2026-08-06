-- Idempotent: reconcile INV-010006
-- Target arithmetic:
--   line final_amount sum = invoice_total = 1050
--   payments_applied = 400
--   retainer_applied = 300
--   write_off_total = 0
--   balance_due = 350
--   invoice_status = Partially Paid
--
-- Quirk: INV-010006 id is ...000004 (not ...000006). Always filter by invoice_number.
-- The former $50 courtesy write-off is kept on INV-010001 so GL history is retained.

BEGIN;

-- INV-010006 header + line already at 1050 / write_down 0
UPDATE public.invoices
SET
  subtotal = 1050,
  write_down_total = 0,
  invoice_total = 1050,
  payments_applied = 400,
  retainer_applied = 300,
  write_off_total = 0,
  balance_due = 350,
  invoice_status = 'Partially Paid',
  updated_at = now()
WHERE invoice_number = 'INV-010006';

UPDATE public.payments
SET
  total_amount = 400,
  unapplied_amount = 0,
  notes = 'Partial collection on INV-010006 (reconciled demo)'
WHERE id = 'bb000000-0000-4000-8000-000000000002';

UPDATE public.payment_applications
SET amount_applied = 400
WHERE id = '38a0e69e-8560-41d1-82dc-a9d52d644e4e';

-- Payment JE (PMT-020002) cash/AR to match $400
UPDATE public.journal_entry_lines jel
SET debit_amount = 400, credit_amount = 0
FROM public.journal_entries je
WHERE jel.journal_entry_id = je.id
  AND je.source_id = 'bb000000-0000-4000-8000-000000000002'
  AND je.source_type = 'Customer Payment'
  AND jel.account_code = '1000';

UPDATE public.journal_entry_lines jel
SET debit_amount = 0, credit_amount = 400
FROM public.journal_entries je
WHERE jel.journal_entry_id = je.id
  AND je.source_id = 'bb000000-0000-4000-8000-000000000002'
  AND je.source_type = 'Customer Payment'
  AND jel.account_code = '1100';

-- Ensure no write-off remains on INV-010006; keep demo write-off on INV-010001
UPDATE public.write_offs wo
SET
  invoice_id = 'aa000000-0000-4000-8000-000000000001',
  client_id = 'b2000000-0000-4000-8000-000000000001',
  matter_id = 'c3000000-0000-4000-8000-000000000001',
  reason = 'Small courtesy write-off relocated from INV-010006 during reconciliation (demo)'
WHERE wo.id = '4d411609-b29a-40e4-be10-6b8dbea87c34';

UPDATE public.journal_entries
SET description = 'Small courtesy write-off on INV-010001'
WHERE id = '3a57e342-0e66-4849-ad0e-0cfc4f5dc29c';

UPDATE public.journal_entry_lines
SET
  client_id = 'b2000000-0000-4000-8000-000000000001',
  matter_id = 'c3000000-0000-4000-8000-000000000001'
WHERE journal_entry_id = '3a57e342-0e66-4849-ad0e-0cfc4f5dc29c';

UPDATE public.invoices
SET
  write_off_total = 50,
  payments_applied = 4450,
  balance_due = 0,
  invoice_status = 'Paid',
  updated_at = now()
WHERE invoice_number = 'INV-010001';

UPDATE public.payments
SET total_amount = 4450
WHERE id = 'bb000000-0000-4000-8000-000000000004';

UPDATE public.payment_applications
SET amount_applied = 4450
WHERE id = 'bc000000-0000-4000-8000-000000000004';

UPDATE public.journal_entry_lines jel
SET debit_amount = 4450, credit_amount = 0
FROM public.journal_entries je
WHERE jel.journal_entry_id = je.id
  AND je.source_id = 'bb000000-0000-4000-8000-000000000004'
  AND je.source_type = 'Customer Payment'
  AND jel.account_code = '1000';

UPDATE public.journal_entry_lines jel
SET debit_amount = 0, credit_amount = 4450
FROM public.journal_entries je
WHERE jel.journal_entry_id = je.id
  AND je.source_id = 'bb000000-0000-4000-8000-000000000004'
  AND je.source_type = 'Customer Payment'
  AND jel.account_code = '1100';

COMMIT;
