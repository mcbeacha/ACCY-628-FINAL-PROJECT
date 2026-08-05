-- Court / filing calendar dates for staff deadline strip (ACCY 628 work tracking)

ALTER TABLE public.matters
  ADD COLUMN IF NOT EXISTS next_court_date date,
  ADD COLUMN IF NOT EXISTS next_filing_deadline date;

COMMENT ON COLUMN public.matters.next_court_date IS
  'Next hearing / court appearance date for the matter.';
COMMENT ON COLUMN public.matters.next_filing_deadline IS
  'Next court or administrative filing deadline.';
