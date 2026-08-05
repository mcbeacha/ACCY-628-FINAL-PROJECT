-- Triggers, follow-up helpers, and Managing Partner conversion RPC
-- Applied remotely via Supabase MCP; kept here for repo parity.

CREATE OR REPLACE FUNCTION public.next_business_day(from_ts timestamptz DEFAULT now())
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE d date := (from_ts AT TIME ZONE 'America/Chicago')::date + 1;
BEGIN
  WHILE EXTRACT(DOW FROM d) IN (0, 6) LOOP
    d := d + 1;
  END LOOP;
  RETURN (d::timestamp + time '17:00') AT TIME ZONE 'America/Chicago';
END;
$$;

CREATE OR REPLACE FUNCTION public.case_eval_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lead_id uuid;
BEGIN
  IF NEW.reference_number IS NULL OR NEW.reference_number = '' THEN
    NEW.reference_number := 'CE-' || to_char(now(), 'YYYY') || '-' || lpad((floor(random()*9000)+1000)::text, 4, '0');
  END IF;
  IF NEW.assigned_paralegal_id IS NULL THEN
    NEW.assigned_paralegal_id := 'a1000000-0000-4000-8000-000000000004';
  END IF;
  IF NEW.assigned_partner_id IS NULL THEN
    SELECT lead_attorney_id INTO lead_id FROM public.practice_area_leads
    WHERE practice_area = NEW.practice_area AND active_status = true LIMIT 1;
    NEW.assigned_partner_id := lead_id;
  END IF;
  IF NEW.follow_up_due_at IS NULL THEN
    NEW.follow_up_due_at := public.next_business_day(NEW.submitted_at);
  END IF;
  IF NEW.submitted_by IS NULL THEN
    NEW.submitted_by := auth.uid();
  END IF;
  NEW.evaluation_status := COALESCE(NEW.evaluation_status, 'New');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_eval_before_insert ON public.case_evaluations;
CREATE TRIGGER trg_case_eval_before_insert
  BEFORE INSERT ON public.case_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.case_eval_before_insert();

CREATE OR REPLACE FUNCTION public.case_eval_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.case_evaluation_activity (evaluation_id, activity_type, activity_notes, performed_by)
  VALUES (NEW.id, 'Evaluation submitted',
    'Case evaluation ' || NEW.reference_number || ' submitted for ' || NEW.practice_area || '.',
    NEW.submitted_by);
  INSERT INTO public.case_evaluation_activity (evaluation_id, activity_type, activity_notes, performed_by)
  VALUES (NEW.id, 'Evaluation assigned to Paralegal',
    'Assigned to intake team for follow-up by ' || COALESCE(NEW.follow_up_due_at::text, 'next business day') || '.',
    NEW.assigned_paralegal_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_eval_after_insert ON public.case_evaluations;
CREATE TRIGGER trg_case_eval_after_insert
  AFTER INSERT ON public.case_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.case_eval_after_insert();

CREATE OR REPLACE FUNCTION public.convert_case_evaluation(p_evaluation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev public.case_evaluations%ROWTYPE;
  new_client_id uuid;
  new_matter_id uuid;
  next_client text;
  next_matter text;
  mname text;
  practice text;
BEGIN
  IF public.current_profile_role() IS DISTINCT FROM 'managing_partner' THEN
    RAISE EXCEPTION 'Only Managing Partner may convert case evaluations';
  END IF;

  SELECT * INTO ev FROM public.case_evaluations WHERE id = p_evaluation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evaluation not found'; END IF;
  IF ev.converted_matter_id IS NOT NULL THEN
    RAISE EXCEPTION 'Evaluation already converted';
  END IF;

  INSERT INTO public.clients (
    client_type, first_name, last_name, email, phone,
    city, state, client_status, created_by
  ) VALUES (
    'Individual', ev.first_name, ev.last_name, ev.email, ev.phone,
    ev.city, ev.state, 'Prospective', auth.uid()
  ) RETURNING id, client_number INTO new_client_id, next_client;

  practice := CASE WHEN ev.practice_area IN ('Not Sure','Other') THEN 'Other' ELSE ev.practice_area END;
  mname := practice || ' — ' || ev.first_name || ' ' || ev.last_name;

  INSERT INTO public.matters (
    client_id, matter_name, matter_description, practice_area,
    matter_status, approval_status, responsible_attorney_id, originating_attorney_id,
    scope_summary, created_by
  ) VALUES (
    new_client_id, mname,
    left(ev.case_summary, 500),
    practice,
    'Draft', 'Draft',
    ev.assigned_partner_id, ev.assigned_partner_id,
    'Drafted from case evaluation ' || ev.reference_number || '. Internal intake notes were not copied.',
    auth.uid()
  ) RETURNING id, matter_number INTO new_matter_id, next_matter;

  UPDATE public.case_evaluations SET
    evaluation_status = 'Accepted',
    converted_client_id = new_client_id,
    converted_matter_id = new_matter_id,
    converted_at = now(),
    converted_by = auth.uid(),
    reviewed_at = COALESCE(reviewed_at, now()),
    reviewed_by = COALESCE(reviewed_by, auth.uid()),
    updated_at = now()
  WHERE id = p_evaluation_id;

  INSERT INTO public.case_evaluation_activity (evaluation_id, activity_type, activity_notes, performed_by)
  VALUES (p_evaluation_id, 'Evaluation converted to prospective client',
    'Created prospective client ' || next_client || ' and draft matter ' || next_matter || '.',
    auth.uid());
  INSERT INTO public.case_evaluation_activity (evaluation_id, activity_type, activity_notes, performed_by)
  VALUES (p_evaluation_id, 'Draft matter created',
    'Draft matter ' || next_matter || ' linked to evaluation ' || ev.reference_number || '.',
    auth.uid());

  RETURN jsonb_build_object(
    'client_id', new_client_id,
    'matter_id', new_matter_id,
    'client_number', next_client,
    'matter_number', next_matter
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.convert_case_evaluation(uuid) TO authenticated;

-- Attorney may update referred evaluations but cannot convert
DROP POLICY IF EXISTS ce_update_attorney ON public.case_evaluations;
CREATE POLICY ce_update_attorney ON public.case_evaluations FOR UPDATE TO authenticated
  USING (public.current_profile_role() = 'attorney' AND assigned_partner_id = auth.uid())
  WITH CHECK (
    public.current_profile_role() = 'attorney'
    AND assigned_partner_id = auth.uid()
    AND converted_matter_id IS NULL
    AND converted_client_id IS NULL
  );
