-- Firm-level editable approval matrix thresholds + stamped approver on submit.

CREATE TABLE IF NOT EXISTS public.firm_approval_thresholds (
  id uuid PRIMARY KEY DEFAULT 'e1900000-0000-4000-8000-000000000001'::uuid,
  routine_expense_cost_mp numeric(12, 2) NOT NULL DEFAULT 1000
    CHECK (routine_expense_cost_mp > 0),
  elevated_expense_cost_mp numeric(12, 2) NOT NULL DEFAULT 500
    CHECK (elevated_expense_cost_mp > 0),
  routine_invoice_mp numeric(12, 2) NOT NULL DEFAULT 5000
    CHECK (routine_invoice_mp > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

INSERT INTO public.firm_approval_thresholds (
  id,
  routine_expense_cost_mp,
  elevated_expense_cost_mp,
  routine_invoice_mp
)
VALUES (
  'e1900000-0000-4000-8000-000000000001'::uuid,
  1000,
  500,
  5000
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.expense_entries
  ADD COLUMN IF NOT EXISTS required_approver_role text;

ALTER TABLE public.matter_cost_entries
  ADD COLUMN IF NOT EXISTS required_approver_role text;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS required_approver_role text;

ALTER TABLE public.firm_approval_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS firm_thresholds_select_staff ON public.firm_approval_thresholds;
CREATE POLICY firm_thresholds_select_staff ON public.firm_approval_thresholds
  FOR SELECT TO authenticated
  USING (
    public.current_profile_role() IN (
      'managing_partner',
      'billing_staff',
      'attorney',
      'paralegal'
    )
  );

DROP POLICY IF EXISTS firm_thresholds_update_mp ON public.firm_approval_thresholds;
CREATE POLICY firm_thresholds_update_mp ON public.firm_approval_thresholds
  FOR UPDATE TO authenticated
  USING (public.current_profile_role() = 'managing_partner')
  WITH CHECK (public.current_profile_role() = 'managing_partner');

-- Staff may set stamp columns on rows they can already update via existing policies;
-- no extra INSERT policy on firm_approval_thresholds (seeded once).
