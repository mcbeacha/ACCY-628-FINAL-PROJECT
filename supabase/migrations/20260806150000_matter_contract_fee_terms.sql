-- Engagement contract fee terms: court premium rate and client maximum charge.
ALTER TABLE public.matters
  ADD COLUMN IF NOT EXISTS court_hourly_rate numeric(14,2)
    CHECK (court_hourly_rate IS NULL OR court_hourly_rate >= 0),
  ADD COLUMN IF NOT EXISTS maximum_fee_amount numeric(14,2)
    CHECK (maximum_fee_amount IS NULL OR maximum_fee_amount >= 0);

COMMENT ON COLUMN public.matters.court_hourly_rate IS
  'Hourly rate for court, hearing, and appearance time; typically higher than the standard hourly rate.';
COMMENT ON COLUMN public.matters.maximum_fee_amount IS
  'Client-facing maximum professional fee (not-to-exceed) under the engagement contract.';
