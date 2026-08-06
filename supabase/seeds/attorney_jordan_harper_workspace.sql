-- Attorney workspace prior data for Jordan Harper only
-- Profile: a1000000-0000-4000-8000-000000000002 (jharper@rebellaw.demo)
-- Idempotent: stable af10… UUIDs + ON CONFLICT / upserts.
-- Works against demo DBs that have Active matters (prefers MT-2001/2003 or Jordan-linked).

DO $$
DECLARE
  jordan uuid := 'a1000000-0000-4000-8000-000000000002';
  m1 uuid;
  m2 uuid;
  m3 uuid;
BEGIN
  -- Prefer known simple-seed matters, else MT-05xxx / any Active
  SELECT id INTO m1 FROM public.matters WHERE matter_number = 'MT-2001';
  IF m1 IS NULL THEN SELECT id INTO m1 FROM public.matters WHERE matter_number = 'MT-05001'; END IF;
  SELECT id INTO m2 FROM public.matters WHERE matter_number = 'MT-2003';
  IF m2 IS NULL THEN SELECT id INTO m2 FROM public.matters WHERE matter_number = 'MT-05002'; END IF;
  SELECT id INTO m3 FROM public.matters WHERE matter_number = 'MT-2002';
  IF m3 IS NULL THEN SELECT id INTO m3 FROM public.matters WHERE matter_number = 'MT-05003'; END IF;

  IF m1 IS NULL THEN
    SELECT id INTO m1 FROM public.matters WHERE matter_status = 'Active' ORDER BY matter_number LIMIT 1;
  END IF;
  IF m2 IS NULL THEN
    SELECT id INTO m2 FROM public.matters WHERE matter_status = 'Active' AND id IS DISTINCT FROM m1 ORDER BY matter_number LIMIT 1;
  END IF;
  IF m3 IS NULL THEN
    SELECT id INTO m3 FROM public.matters WHERE matter_status = 'Active' AND id IS DISTINCT FROM m1 AND id IS DISTINCT FROM m2 ORDER BY matter_number LIMIT 1;
  END IF;

  IF m1 IS NULL THEN
    RAISE NOTICE 'attorney_jordan_harper_workspace: no Active matters found; skipping';
    RETURN;
  END IF;

  m2 := COALESCE(m2, m1);
  m3 := COALESCE(m3, m1);

  -- Assign Jordan as responsible on primary matters (attorney-only prior data)
  UPDATE public.matters
  SET responsible_attorney_id = jordan,
      next_court_date = (CURRENT_DATE + 5),
      next_filing_deadline = (CURRENT_DATE + 2),
      updated_at = now()
  WHERE id = m1;

  UPDATE public.matters
  SET responsible_attorney_id = jordan,
      next_court_date = (CURRENT_DATE + 11),
      next_filing_deadline = (CURRENT_DATE + 8),
      updated_at = now()
  WHERE id = m2 AND m2 IS DISTINCT FROM m1;

  -- matter_assignments if table exists with expected columns
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'matter_assignments'
  ) THEN
    INSERT INTO public.matter_assignments (id, matter_id, user_id, assignment_role, assigned_at, assigned_by, active_status)
    VALUES
      ('af100000-0000-4000-8000-0000000000a1', m1, jordan, 'Lead Attorney', now(), jordan, true),
      ('af100000-0000-4000-8000-0000000000a2', m2, jordan, 'Lead Attorney', now(), jordan, true)
    ON CONFLICT (id) DO UPDATE SET
      matter_id = EXCLUDED.matter_id,
      user_id = EXCLUDED.user_id,
      assignment_role = EXCLUDED.assignment_role,
      active_status = true;
  END IF;

  INSERT INTO public.matter_tasks (
    id, matter_id, task_title, task_description, assigned_to, task_status, priority,
    due_date, client_visible, internal_notes, created_by, created_at, updated_at, out_of_scope
  ) VALUES
    ('af100000-0000-4000-8000-000000000101', m1,
     'Draft opposition to motion to compel',
     'Prepare opposition brief and supporting declaration for filing.',
     jordan, 'In Progress', 'High', CURRENT_DATE - 1, false, 'Nearly ready for partner review', jordan, now() - interval '3 days', now(), false),
    ('af100000-0000-4000-8000-000000000102', m1,
     'Confirm hearing exhibit list with client',
     'Call client to finalize exhibit order for upcoming hearing.',
     jordan, 'Not Started', 'Urgent', CURRENT_DATE, false, NULL, jordan, now() - interval '1 day', now(), false),
    ('af100000-0000-4000-8000-000000000103', m1,
     'Review opposing counsel discovery responses',
     'Flag incomplete responses and draft meet-and-confer letter.',
     jordan, 'In Progress', 'High', CURRENT_DATE + 3, false, NULL, jordan, now() - interval '2 days', now(), false),
    ('af100000-0000-4000-8000-000000000104', m2,
     'Prepare estate inventory summary',
     'Summarize assets for client meeting and court filing package.',
     jordan, 'Waiting', 'Normal', CURRENT_DATE + 1, true, 'Waiting on bank statements', jordan, now() - interval '4 days', now(), false),
    ('af100000-0000-4000-8000-000000000105', m2,
     'File notice of appearance',
     'E-file notice and serve interested parties.',
     jordan, 'Not Started', 'High', CURRENT_DATE + 4, false, NULL, jordan, now() - interval '1 day', now(), false),
    ('af100000-0000-4000-8000-000000000106', m2,
     'Update beneficiary contact list',
     'Verify mailing addresses before next court date.',
     jordan, 'In Progress', 'Normal', CURRENT_DATE + 7, false, NULL, jordan, now() - interval '5 days', now(), false),
    ('af100000-0000-4000-8000-000000000107', m3,
     'Outline settlement demand letter',
     'Internal outline of damages and liability theories.',
     jordan, 'Not Started', 'High', CURRENT_DATE + 2, false, NULL, jordan, now() - interval '2 days', now(), false),
    ('af100000-0000-4000-8000-000000000108', m3,
     'Calendar deposition follow-ups',
     'Track transcript errata deadlines after vendor deposition.',
     jordan, 'Waiting', 'Normal', CURRENT_DATE - 3, false, 'Waiting on court reporter', jordan, now() - interval '6 days', now(), false),
    ('af100000-0000-4000-8000-000000000109', m1,
     'Log research time for motion practice',
     'Enter time for last week research block before week close.',
     jordan, 'Not Started', 'Normal', CURRENT_DATE + 9, false, NULL, jordan, now(), now(), false),
    ('af100000-0000-4000-8000-000000000110', m3,
     'Client status email — case strategy',
     'Send concise status update covering next hearing and open tasks.',
     jordan, 'In Progress', 'Urgent', CURRENT_DATE, true, NULL, jordan, now() - interval '12 hours', now(), false)
  ON CONFLICT (id) DO UPDATE SET
    matter_id = EXCLUDED.matter_id,
    task_title = EXCLUDED.task_title,
    task_description = EXCLUDED.task_description,
    assigned_to = EXCLUDED.assigned_to,
    task_status = EXCLUDED.task_status,
    priority = EXCLUDED.priority,
    due_date = EXCLUDED.due_date,
    internal_notes = EXCLUDED.internal_notes,
    updated_at = now();

  INSERT INTO public.matter_activity (
    id, matter_id, client_id, action_type, action_description, performed_by, created_at
  ) VALUES
    ('af100000-0000-4000-8000-000000000201', m1, NULL, 'document',
     'uploaded draft opposition brief for partner review', jordan, now() - interval '45 minutes'),
    ('af100000-0000-4000-8000-000000000202', m1, NULL, 'task',
     'completed conflict check confirmation for hearing exhibits', jordan, now() - interval '2 hours'),
    ('af100000-0000-4000-8000-000000000203', m2, NULL, 'note',
     'added note from client call regarding inventory documents', jordan, now() - interval '5 hours'),
    ('af100000-0000-4000-8000-000000000204', m3, NULL, 'time',
     'logged 1.8 hours of settlement research', jordan, now() - interval '8 hours'),
    ('af100000-0000-4000-8000-000000000205', m1, NULL, 'status',
     'updated matter status notes ahead of motion hearing', jordan, now() - interval '1 day'),
    ('af100000-0000-4000-8000-000000000206', m2, NULL, 'deadline',
     'added filing deadline for estate inventory summary', jordan, now() - interval '1 day 3 hours'),
    ('af100000-0000-4000-8000-000000000207', m3, NULL, 'document',
     'edited vendor contract chronology memorandum', jordan, now() - interval '2 days'),
    ('af100000-0000-4000-8000-000000000208', m1, NULL, 'message',
     'sent message to client confirming exhibit list call', jordan, now() - interval '2 days 4 hours'),
    ('af100000-0000-4000-8000-000000000209', m3, NULL, 'task',
     'completed outline checklist for settlement demand', jordan, now() - interval '3 days'),
    ('af100000-0000-4000-8000-000000000210', m2, NULL, 'document',
     'uploaded bank statement package from client', jordan, now() - interval '4 days')
  ON CONFLICT (id) DO UPDATE SET
    matter_id = EXCLUDED.matter_id,
    action_type = EXCLUDED.action_type,
    action_description = EXCLUDED.action_description,
    performed_by = EXCLUDED.performed_by,
    created_at = EXCLUDED.created_at;
END $$;
