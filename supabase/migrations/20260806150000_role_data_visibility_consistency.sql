-- Role data consistency: finance staff matter visibility + client portal lead attorney
-- Billing/partner must see all matters/clients used by invoices/AR/retainers/trust.
-- Clients must be able to resolve responsible attorney profile embeds on their matters.

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;

DROP POLICY IF EXISTS matters_select_finance_staff ON public.matters;
CREATE POLICY matters_select_finance_staff ON public.matters
  FOR SELECT TO authenticated
  USING (public.current_profile_role() IN ('managing_partner', 'billing_staff'));

DROP POLICY IF EXISTS clients_select_finance_staff ON public.clients;
CREATE POLICY clients_select_finance_staff ON public.clients
  FOR SELECT TO authenticated
  USING (public.current_profile_role() IN ('managing_partner', 'billing_staff'));

DROP POLICY IF EXISTS profiles_select_staff ON public.profiles;
CREATE POLICY profiles_select_staff ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.current_profile_role() IN ('managing_partner', 'billing_staff', 'attorney', 'paralegal')
  );

DROP POLICY IF EXISTS profiles_select_client_matter_team ON public.profiles;
CREATE POLICY profiles_select_client_matter_team ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.current_profile_role() = 'client'
    AND EXISTS (
      SELECT 1
      FROM public.matters m
      JOIN public.clients c ON c.id = m.client_id
      WHERE c.portal_user_id = auth.uid()
        AND (
          m.responsible_attorney_id = profiles.id
          OR m.originating_attorney_id = profiles.id
          OR EXISTS (
            SELECT 1
            FROM public.matter_assignments ma
            WHERE ma.matter_id = m.id
              AND ma.user_id = profiles.id
              AND COALESCE(ma.active_status, true) = true
          )
        )
    )
  );
