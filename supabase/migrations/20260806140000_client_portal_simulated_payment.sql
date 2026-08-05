-- Client portal simulated payment (SECURITY DEFINER)
-- Applied remotely via Supabase MCP; kept for repo parity.

CREATE OR REPLACE FUNCTION public.client_portal_simulated_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_payment_method text,
  p_reference_number text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  client_row public.clients%ROWTYPE;
  pay_id uuid;
  pay_num text;
  method text;
BEGIN
  IF public.current_profile_role() IS DISTINCT FROM 'client' THEN
    RAISE EXCEPTION 'Only clients may use the client portal payment form';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero';
  END IF;

  SELECT * INTO inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
  IF inv.finalized_at IS NULL THEN RAISE EXCEPTION 'Only finalized invoices can be paid'; END IF;

  SELECT * INTO client_row FROM public.clients WHERE id = inv.client_id;
  IF client_row.portal_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You may only pay invoices for your own client account';
  END IF;

  IF p_amount > inv.balance_due THEN
    RAISE EXCEPTION 'Payment cannot exceed the balance due (%)', inv.balance_due;
  END IF;

  method := COALESCE(NULLIF(trim(p_payment_method), ''), 'Other');
  IF method NOT IN ('Credit Card', 'ACH', 'Check', 'Other', 'Cash', 'Wire') THEN
    method := 'Other';
  END IF;

  INSERT INTO public.payments (
    client_id, matter_id, payment_date, payment_method, total_amount,
    reference_number, payment_status, unapplied_amount, notes, entered_by
  ) VALUES (
    inv.client_id, inv.matter_id, CURRENT_DATE, method, p_amount,
    COALESCE(NULLIF(trim(p_reference_number), ''), 'PORTAL-SIM-' || to_char(now(), 'YYYYMMDD-HH24MISS')),
    'Draft', p_amount,
    'Simulated client-portal payment (academic demo). No real funds processed.',
    auth.uid()
  )
  RETURNING id, payment_number INTO pay_id, pay_num;

  INSERT INTO public.payment_applications (payment_id, invoice_id, amount_applied, applied_by)
  VALUES (pay_id, inv.id, p_amount, auth.uid());

  PERFORM public.post_payment(pay_id);

  RETURN jsonb_build_object(
    'payment_id', pay_id,
    'payment_number', pay_num,
    'amount', p_amount,
    'invoice_id', inv.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_portal_simulated_payment(uuid, numeric, text, text) TO authenticated;
