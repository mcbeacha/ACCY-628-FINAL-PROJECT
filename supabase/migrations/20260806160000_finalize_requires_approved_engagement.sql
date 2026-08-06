-- Finalize invoice requires the linked matter engagement to be Approved.

CREATE OR REPLACE FUNCTION public.finalize_invoice(p_invoice_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_matter public.matters%ROWTYPE;
  v_je_id uuid;
  v_fees numeric(14,2);
  v_exp numeric(14,2);
  v_uid uuid := auth.uid();
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;
  IF v_inv.finalized_at IS NOT NULL THEN
    RAISE EXCEPTION 'Invoice already finalized';
  END IF;
  IF v_inv.approval_status NOT IN ('Approved') AND v_inv.invoice_status NOT IN ('Approved') THEN
    RAISE EXCEPTION 'Invoice must be approved before finalize';
  END IF;

  SELECT * INTO v_matter FROM public.matters WHERE id = v_inv.matter_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Matter not found for invoice %', p_invoice_id;
  END IF;
  IF v_matter.approval_status IS DISTINCT FROM 'Approved' THEN
    RAISE EXCEPTION 'Billing is blocked until the engagement is approved.';
  END IF;

  PERFORM public.recalc_invoice_totals(p_invoice_id);
  SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;

  UPDATE public.invoices
  SET
    finalized_at = now(),
    finalized_by = COALESCE(v_uid, finalized_by),
    invoice_status = 'Finalized',
    approval_status = 'Approved'
  WHERE id = p_invoice_id;

  UPDATE public.time_entries
  SET invoice_status = 'Billed', locked_status = true, invoice_id = p_invoice_id
  WHERE id IN (
    SELECT time_entry_id FROM public.invoice_lines
    WHERE invoice_id = p_invoice_id AND time_entry_id IS NOT NULL
  );

  UPDATE public.expense_entries
  SET invoice_status = 'Billed', locked_status = true, invoice_id = p_invoice_id
  WHERE id IN (
    SELECT expense_entry_id FROM public.invoice_lines
    WHERE invoice_id = p_invoice_id AND expense_entry_id IS NOT NULL
  );

  v_fees := COALESCE(v_inv.subtotal, 0);
  v_exp := COALESCE(v_inv.expense_total, 0);

  INSERT INTO public.journal_entries (
    entry_date, source_type, description, posting_status,
    source_record_type, source_record_id, created_by
  ) VALUES (
    COALESCE(v_inv.invoice_date, CURRENT_DATE),
    'Invoice Finalization',
    'AR for ' || v_inv.invoice_number,
    'Posted',
    'invoice',
    p_invoice_id,
    v_uid
  ) RETURNING id INTO v_je_id;

  INSERT INTO public.journal_entry_lines (
    journal_entry_id, account_code, account_name, debit_amount, credit_amount, client_id, matter_id
  ) VALUES
    (v_je_id, '1200', 'Accounts Receivable', v_inv.invoice_total, 0, v_inv.client_id, v_inv.matter_id),
    (v_je_id, '4000', 'Fee Revenue', 0, v_fees, v_inv.client_id, v_inv.matter_id);

  IF v_exp > 0 THEN
    INSERT INTO public.journal_entry_lines (
      journal_entry_id, account_code, account_name, debit_amount, credit_amount, client_id, matter_id
    ) VALUES
      (v_je_id, '4100', 'Expense Recoveries', 0, v_exp, v_inv.client_id, v_inv.matter_id);
  END IF;

  IF v_inv.invoice_total > (v_fees + v_exp) THEN
    INSERT INTO public.journal_entry_lines (
      journal_entry_id, account_code, account_name, debit_amount, credit_amount, client_id, matter_id
    ) VALUES
      (v_je_id, '2200', 'Tax / Other Payable', 0, v_inv.invoice_total - v_fees - v_exp, v_inv.client_id, v_inv.matter_id);
  ELSIF v_inv.invoice_total < (v_fees + v_exp) THEN
    INSERT INTO public.journal_entry_lines (
      journal_entry_id, account_code, account_name, debit_amount, credit_amount, client_id, matter_id
    ) VALUES
      (v_je_id, '4900', 'Credits / Adjustments', (v_fees + v_exp) - v_inv.invoice_total, 0, v_inv.client_id, v_inv.matter_id);
  END IF;

  INSERT INTO public.financial_activity (
    action_type, record_type, record_id, matter_id, performed_by, action_description, details
  ) VALUES (
    'invoice_finalized', 'invoice', p_invoice_id, v_inv.matter_id, v_uid,
    'Invoice ' || v_inv.invoice_number || ' finalized.',
    'Invoice ' || v_inv.invoice_number || ' finalized.'
  );
END;
$function$;
