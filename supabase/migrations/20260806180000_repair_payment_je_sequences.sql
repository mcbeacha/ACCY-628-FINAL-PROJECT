-- Fix document-number sequences that fall behind seed data, and make
-- payment posting allocate journal entry numbers from MAX+1 so inserts
-- cannot collide with existing JE-###### rows.

CREATE OR REPLACE FUNCTION public.next_prefixed_number(
  p_prefix text,
  p_table regclass,
  p_column text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max integer := 0;
  v_sql text;
BEGIN
  v_sql := format(
    'SELECT COALESCE(MAX(NULLIF(regexp_replace(%I, %L, %L), %L)::integer), 0) FROM %s WHERE %I ~ %L',
    p_column,
    '^' || p_prefix,
    '',
    '',
    p_table,
    p_column,
    '^' || p_prefix || '[0-9]+$'
  );
  EXECUTE v_sql INTO v_max;
  RETURN p_prefix || lpad((COALESCE(v_max, 0) + 1)::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_demo_document_sequences()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay integer;
  v_je integer;
  v_seq regclass;
BEGIN
  SELECT COALESCE(MAX(NULLIF(regexp_replace(payment_number, '^PMT-', ''), '')::integer), 0)
  INTO v_pay FROM public.payments WHERE payment_number ~ '^PMT-[0-9]+$';

  SELECT COALESCE(MAX(NULLIF(regexp_replace(journal_entry_number, '^JE-', ''), '')::integer), 0)
  INTO v_je FROM public.journal_entries WHERE journal_entry_number ~ '^JE-[0-9]+$';

  -- Best-effort sequence sync when serial/identity sequences exist.
  BEGIN
    SELECT pg_get_serial_sequence('public.payments', 'payment_number')::regclass INTO v_seq;
  EXCEPTION WHEN OTHERS THEN
    v_seq := NULL;
  END;

  -- Named sequences used by some demo schemas
  IF to_regclass('public.payment_number_seq') IS NOT NULL THEN
    PERFORM setval('public.payment_number_seq', GREATEST(v_pay, 1), true);
  END IF;
  IF to_regclass('public.journal_entry_number_seq') IS NOT NULL THEN
    PERFORM setval('public.journal_entry_number_seq', GREATEST(v_je, 1), true);
  END IF;
  IF to_regclass('public.payments_payment_number_seq') IS NOT NULL THEN
    PERFORM setval('public.payments_payment_number_seq', GREATEST(v_pay, 1), true);
  END IF;
  IF to_regclass('public.journal_entries_journal_entry_number_seq') IS NOT NULL THEN
    PERFORM setval('public.journal_entries_journal_entry_number_seq', GREATEST(v_je, 1), true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.post_payment(p_payment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_pay public.payments%ROWTYPE;
  v_app record;
  v_applied numeric(14,2) := 0;
  v_je_id uuid;
  v_je_number text;
  v_uid uuid := auth.uid();
BEGIN
  PERFORM public.repair_demo_document_sequences();

  SELECT * INTO v_pay FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found', p_payment_id;
  END IF;
  IF v_pay.payment_status = 'Posted' THEN
    RAISE EXCEPTION 'Payment already posted';
  END IF;
  IF v_pay.payment_status = 'Reversed' THEN
    RAISE EXCEPTION 'Cannot post a reversed payment';
  END IF;

  FOR v_app IN
    SELECT * FROM public.payment_applications WHERE payment_id = p_payment_id
  LOOP
    UPDATE public.invoices
    SET payments_applied = COALESCE(payments_applied, 0) + v_app.amount_applied
    WHERE id = v_app.invoice_id;

    PERFORM public.recalc_invoice_totals(v_app.invoice_id);

    UPDATE public.invoices
    SET invoice_status = CASE
      WHEN balance_due <= 0 THEN 'Paid'
      WHEN payments_applied + retainer_applied > 0 THEN 'Partially Paid'
      ELSE invoice_status
    END
    WHERE id = v_app.invoice_id
      AND finalized_at IS NOT NULL;

    v_applied := v_applied + v_app.amount_applied;
  END LOOP;

  IF v_applied > v_pay.total_amount THEN
    RAISE EXCEPTION 'Applications exceed payment total';
  END IF;

  UPDATE public.payments
  SET
    payment_status = 'Posted',
    unapplied_amount = GREATEST(v_pay.total_amount - v_applied, 0)
  WHERE id = p_payment_id;

  v_je_number := public.next_prefixed_number('JE-', 'public.journal_entries'::regclass, 'journal_entry_number');

  -- Support both demo schemas: source_id vs source_record_*.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'source_id'
  ) THEN
    INSERT INTO public.journal_entries (
      journal_entry_number, entry_date, source_type, source_id, description, posting_status, created_by
    ) VALUES (
      v_je_number,
      COALESCE(v_pay.payment_date, CURRENT_DATE),
      'Payment',
      p_payment_id,
      'Payment ' || v_pay.payment_number,
      'Posted',
      COALESCE(v_pay.entered_by, v_uid)
    ) RETURNING id INTO v_je_id;
  ELSE
    INSERT INTO public.journal_entries (
      journal_entry_number, entry_date, source_type, description, posting_status,
      source_record_type, source_record_id, created_by
    ) VALUES (
      v_je_number,
      COALESCE(v_pay.payment_date, CURRENT_DATE),
      'Payment',
      'Payment ' || v_pay.payment_number,
      'Posted',
      'payment',
      p_payment_id,
      COALESCE(v_pay.entered_by, v_uid)
    ) RETURNING id INTO v_je_id;
  END IF;

  INSERT INTO public.journal_entry_lines (
    journal_entry_id, account_code, account_name, debit_amount, credit_amount, client_id, matter_id
  ) VALUES
    (v_je_id, '1000', 'Cash', v_pay.total_amount, 0, v_pay.client_id, v_pay.matter_id);

  IF v_applied > 0 THEN
    INSERT INTO public.journal_entry_lines (
      journal_entry_id, account_code, account_name, debit_amount, credit_amount, client_id, matter_id
    ) VALUES
      (v_je_id, '1200', 'Accounts Receivable', 0, v_applied, v_pay.client_id, v_pay.matter_id);
  END IF;

  IF v_pay.total_amount - v_applied > 0 THEN
    INSERT INTO public.journal_entry_lines (
      journal_entry_id, account_code, account_name, debit_amount, credit_amount, client_id, matter_id
    ) VALUES
      (v_je_id, '2500', 'Unapplied Client Credits', 0, v_pay.total_amount - v_applied, v_pay.client_id, v_pay.matter_id);
  END IF;

  INSERT INTO public.financial_activity (
    action_type, record_type, record_id, matter_id, performed_by, action_description, details
  ) VALUES (
    'payment_posted', 'payment', p_payment_id, v_pay.matter_id, COALESCE(v_pay.entered_by, v_uid),
    'Payment ' || v_pay.payment_number || ' posted.',
    'Payment posted'
  );
END;
$$;

-- Also harden portal payments against stale payment_number sequences.
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

  pay_num := public.next_prefixed_number('PMT-', 'public.payments'::regclass, 'payment_number');

  INSERT INTO public.payments (
    payment_number, client_id, matter_id, payment_date, payment_method, total_amount,
    reference_number, payment_status, unapplied_amount, notes, entered_by
  ) VALUES (
    pay_num, inv.client_id, inv.matter_id, CURRENT_DATE, method, p_amount,
    COALESCE(NULLIF(trim(p_reference_number), ''), 'PORTAL-SIM-' || to_char(now(), 'YYYYMMDD-HH24MISS')),
    'Draft', p_amount,
    'Simulated client-portal payment (academic demo). No real funds processed.',
    auth.uid()
  )
  RETURNING id INTO pay_id;

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

GRANT EXECUTE ON FUNCTION public.next_prefixed_number(text, regclass, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_demo_document_sequences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.post_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.client_portal_simulated_payment(uuid, numeric, text, text) TO authenticated;

SELECT public.repair_demo_document_sequences();
