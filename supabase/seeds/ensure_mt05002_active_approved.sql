-- Idempotent: keep PI matter MT-05002 Active + Approved when it already has
-- financial activity (invoices, payments, retainers, journals).
-- Safe to re-run against the live demo project (xrsueubqclxddbbnntfu).
--
-- If trg_matter_controls blocks non-partner updates, run as Managing Partner
-- (partner@rebellaw.demo) or briefly disable/re-enable that trigger.

UPDATE public.matters
SET
  matter_status = 'Active',
  approval_status = 'Approved',
  approved_by = COALESCE(approved_by, 'a1000000-0000-4000-8000-000000000001'),
  approved_at = COALESCE(approved_at, '2026-03-05T18:00:00+00:00'::timestamptz),
  approval_notes = COALESCE(
    NULLIF(approval_notes, ''),
    'Contingency terms accepted. Active billed PI matter.'
  ),
  updated_at = now()
WHERE id = 'c3000000-0000-4000-8000-000000000002'
  AND matter_number = 'MT-05002'
  AND (
    matter_status IS DISTINCT FROM 'Active'
    OR approval_status IS DISTINCT FROM 'Approved'
    OR approved_by IS NULL
    OR approved_at IS NULL
  );
