-- Idempotent: PI Client Trust / settlement ledger for MT-05002
-- Replaces retainer-style PI deposits/fee applications with:
--   Settlement Proceeds → Lien → Cost Reimbursement → Attorney Fee → Client Distribution
-- Also detangles INV-010006 from PI retainer apply (payment $700, retainer $0, balance $350).
--
-- Note: RLS may block DELETE on retainer_transactions for app roles; this script therefore
-- UPDATEs the known demo PI row ids in place and UPSERTs the client-distribution row.

BEGIN;

UPDATE public.retainer_accounts
SET
  initial_required_amount = 75000,
  replenishment_threshold = 0,
  current_balance = 0,
  account_status = 'Active',
  updated_at = now()
WHERE id = 'd4000000-0000-4000-8000-000000000002';

-- 1) Settlement Proceeds
UPDATE public.retainer_transactions
SET
  retainer_account_id = 'd4000000-0000-4000-8000-000000000002',
  matter_id = 'c3000000-0000-4000-8000-000000000002',
  transaction_date = '2026-07-28',
  transaction_type = 'Deposit',
  amount = 75000.00,
  description = 'Settlement proceeds — insurer settlement check deposited to client trust',
  reference_number = 'SET-DEMO-75000',
  approval_status = 'Approved',
  approved_by = 'a1000000-0000-4000-8000-000000000001',
  approved_at = '2026-07-28T18:00:00+00:00',
  related_invoice_id = NULL
WHERE id = 'a7af03ba-bcf4-43b8-825c-d6760fd41379';

-- 2) Lien Payment
UPDATE public.retainer_transactions
SET
  transaction_date = '2026-08-01',
  transaction_type = 'Adjustment Decrease',
  amount = 12500.00,
  description = 'Medical lien payment from client trust',
  reference_number = 'LIEN-DEMO-12500',
  approval_status = 'Approved',
  approved_by = 'a1000000-0000-4000-8000-000000000001',
  approved_at = '2026-08-01T18:00:00+00:00',
  related_invoice_id = NULL
WHERE id = 'b13b60f2-f87a-443c-a45a-495046b3b5a0';

-- 3) Cost Reimbursement
UPDATE public.retainer_transactions
SET
  transaction_date = '2026-08-02',
  transaction_type = 'Applied to Expenses',
  amount = 2850.00,
  description = 'Cost reimbursement — firm case costs repaid from client trust',
  reference_number = 'COST-DEMO-2850',
  approval_status = 'Approved',
  approved_by = 'a1000000-0000-4000-8000-000000000001',
  approved_at = '2026-08-02T18:00:00+00:00',
  related_invoice_id = NULL
WHERE id = '5c4ba8bd-72f0-496f-868b-818eabf570be';

-- 4) Attorney Fee Transfer
UPDATE public.retainer_transactions
SET
  transaction_date = '2026-08-03',
  transaction_type = 'Applied to Fees',
  amount = 25000.00,
  description = 'Attorney fee transfer — contingency fee to Rebel Law Group',
  reference_number = 'FEE-DEMO-25000',
  approval_status = 'Approved',
  approved_by = 'a1000000-0000-4000-8000-000000000001',
  approved_at = '2026-08-03T18:00:00+00:00',
  related_invoice_id = NULL
WHERE id = '265b0f9b-30d4-4210-9025-eab29ecd7414';

-- 5) Client Distribution
INSERT INTO public.retainer_transactions (
  id, retainer_account_id, matter_id, transaction_date, transaction_type, amount,
  description, reference_number, approval_status, approved_by, approved_at,
  related_invoice_id, created_by, created_at
) VALUES (
  'e7000000-0000-4000-8000-000000000005',
  'd4000000-0000-4000-8000-000000000002',
  'c3000000-0000-4000-8000-000000000002',
  '2026-08-04',
  'Refund',
  34650.00,
  'Client distribution — net settlement proceeds to client',
  'DIST-DEMO-34650',
  'Approved',
  'a1000000-0000-4000-8000-000000000001',
  '2026-08-04T18:00:00+00:00',
  NULL,
  'a1000000-0000-4000-8000-000000000005',
  '2026-08-04T18:00:00+00:00'
)
ON CONFLICT (id) DO UPDATE SET
  retainer_account_id = EXCLUDED.retainer_account_id,
  matter_id = EXCLUDED.matter_id,
  transaction_date = EXCLUDED.transaction_date,
  transaction_type = EXCLUDED.transaction_type,
  amount = EXCLUDED.amount,
  description = EXCLUDED.description,
  reference_number = EXCLUDED.reference_number,
  approval_status = EXCLUDED.approval_status,
  approved_by = EXCLUDED.approved_by,
  approved_at = EXCLUDED.approved_at,
  related_invoice_id = EXCLUDED.related_invoice_id;

-- INV-010006: no retainer story; payment $700 ⇒ balance $350
UPDATE public.invoices
SET
  retainer_applied = 0,
  payments_applied = 700,
  write_off_total = 0,
  balance_due = 350,
  invoice_status = 'Partially Paid',
  updated_at = now()
WHERE invoice_number = 'INV-010006';

UPDATE public.payments
SET
  total_amount = 700,
  unapplied_amount = 0,
  notes = 'Partial collection on INV-010006 (no retainer applied)'
WHERE id = 'bb000000-0000-4000-8000-000000000002';

UPDATE public.payment_applications
SET amount_applied = 700
WHERE id = '38a0e69e-8560-41d1-82dc-a9d52d644e4e';

UPDATE public.journal_entry_lines jel
SET debit_amount = 700, credit_amount = 0
FROM public.journal_entries je
WHERE jel.journal_entry_id = je.id
  AND je.source_id = 'bb000000-0000-4000-8000-000000000002'
  AND je.source_type = 'Customer Payment'
  AND jel.account_code = '1000';

UPDATE public.journal_entry_lines jel
SET debit_amount = 0, credit_amount = 700
FROM public.journal_entries je
WHERE jel.journal_entry_id = je.id
  AND je.source_id = 'bb000000-0000-4000-8000-000000000002'
  AND je.source_type = 'Customer Payment'
  AND jel.account_code = '1100';

UPDATE public.journal_entries
SET
  description = 'Reversed — former PI retainer apply removed (settlement trust demo)',
  posting_status = 'Reversed'
WHERE id = 'f7553be8-378c-499f-ba59-e6a5cd3a4041';

UPDATE public.journal_entry_lines
SET debit_amount = 0, credit_amount = 0
WHERE journal_entry_id = 'f7553be8-378c-499f-ba59-e6a5cd3a4041';

COMMIT;
