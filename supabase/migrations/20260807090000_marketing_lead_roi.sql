-- Marketing lead attribution + campaign spend (fictional academic data)
-- Depends on: matters, clients, profiles; optionally case_evaluations, cost_categories, cost_allocations, vendors

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Lead sources (controlled channel list)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_code text NOT NULL UNIQUE,
  source_name text NOT NULL UNIQUE,
  channel_group text NOT NULL CHECK (channel_group IN (
    'Paid Search','Local Services','Organic','Social','Referral','Lead Purchase','Other'
  )),
  description text,
  active_status boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 100,
  is_demo_data boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.lead_sources (id, source_code, source_name, channel_group, description, display_order) VALUES
  ('d1000000-0000-4000-8000-000000000001','google_ads','Google Ads (PPC)','Paid Search','High-intent search ads (e.g. car accident lawyer).',10),
  ('d1000000-0000-4000-8000-000000000002','google_lsa','Google Local Services Ads','Local Services','Pay-per-lead local listings with Google Screened badge.',20),
  ('d1000000-0000-4000-8000-000000000003','seo_organic','SEO & Organic Web','Organic','Organic search and content landing pages.',30),
  ('d1000000-0000-4000-8000-000000000004','meta_youtube','Meta / YouTube Ads','Social','Short-form video and social awareness ads.',40),
  ('d1000000-0000-4000-8000-000000000005','referral','Referral Network','Referral','Attorney, client, and community referrals.',50),
  ('d1000000-0000-4000-8000-000000000006','legal_ppl','Legal Directory / PPL','Lead Purchase','Third-party exclusive or shared legal leads.',60),
  ('d1000000-0000-4000-8000-000000000007','walk_in','Walk-in / Other','Other','Walk-in, unknown, or unclassified sources.',70)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Marketing campaigns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_code text NOT NULL UNIQUE,
  campaign_name text NOT NULL,
  lead_source_id uuid NOT NULL REFERENCES public.lead_sources(id),
  practice_area text,
  status text NOT NULL DEFAULT 'Active'
    CHECK (status IN ('Draft','Active','Paused','Completed')),
  tracking_phone text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  start_date date,
  end_date date,
  budget_amount numeric(14,2) CHECK (budget_amount IS NULL OR budget_amount >= 0),
  notes text,
  is_demo_data boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_campaigns_source_idx ON public.marketing_campaigns(lead_source_id);
CREATE INDEX IF NOT EXISTS marketing_campaigns_status_idx ON public.marketing_campaigns(status);

INSERT INTO public.marketing_campaigns (
  id, campaign_code, campaign_name, lead_source_id, practice_area, status,
  tracking_phone, utm_source, utm_medium, utm_campaign, start_date, budget_amount, notes
) VALUES
  ('d2000000-0000-4000-8000-000000000001','CAMP-PI-PPC',
   'Oxford PI — Car Accident Search','d1000000-0000-4000-8000-000000000001','Personal Injury','Active',
   '(662) 555-0101','google','cpc','oxford_pi_car_accident','2026-01-01',4500,
   'Demo PPC campaign for Personal Injury search terms.'),
  ('d2000000-0000-4000-8000-000000000002','CAMP-PI-LSA',
   'Oxford PI — Local Services','d1000000-0000-4000-8000-000000000002','Personal Injury','Active',
   '(662) 555-0102','google','lsa','oxford_pi_lsa','2026-01-01',2200,
   'Demo LSA pay-per-lead campaign.'),
  ('d2000000-0000-4000-8000-000000000003','CAMP-BIZ-SEO',
   'Business Law — Organic Content','d1000000-0000-4000-8000-000000000003','Business Law','Active',
   NULL,'rebel','organic','business_law_guides','2026-01-01',800,
   'Content/SEO investment allocated monthly.'),
  ('d2000000-0000-4000-8000-000000000004','CAMP-REF',
   'Attorney Referral Network','d1000000-0000-4000-8000-000000000005',NULL,'Active',
   NULL,'referral','partner','attorney_network','2026-01-01',0,
   'No media spend; track referral conversion only.'),
  ('d2000000-0000-4000-8000-000000000005','CAMP-PROBATE-PPL',
   'Probate Directory Leads','d1000000-0000-4000-8000-000000000006','Probate','Active',
   '(662) 555-0106','avvo','cpc','probate_ppl','2026-02-01',1500,
   'Third-party probate lead purchase.')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Ensure Advertising cost category exists (cost schema may already be present)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cost_categories'
  ) THEN
    INSERT INTO public.cost_categories (
      id, category_name, category_group, default_reimbursable_status, requires_receipt, requires_approval, active_status, is_demo_data
    ) VALUES (
      'd4000000-0000-4000-8000-000000000001',
      'Advertising / Marketing',
      'Allocated Costs',
      false, true, true, true, true
    )
    ON CONFLICT (category_name) DO NOTHING;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Marketing spend
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.marketing_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id),
  spend_date date NOT NULL DEFAULT CURRENT_DATE,
  period_start date,
  period_end date,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  vendor_id uuid,
  description text,
  approval_status text NOT NULL DEFAULT 'Draft'
    CHECK (approval_status IN ('Draft','Submitted','Approved','Rejected')),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  cost_allocation_id uuid,
  notes text,
  is_demo_data boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Optional FKs when related tables exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vendors')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'marketing_spend_vendor_id_fkey'
     ) THEN
    ALTER TABLE public.marketing_spend
      ADD CONSTRAINT marketing_spend_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES public.vendors(id);
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cost_allocations')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'marketing_spend_cost_allocation_id_fkey'
     ) THEN
    ALTER TABLE public.marketing_spend
      ADD CONSTRAINT marketing_spend_cost_allocation_id_fkey
      FOREIGN KEY (cost_allocation_id) REFERENCES public.cost_allocations(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS marketing_spend_campaign_idx ON public.marketing_spend(campaign_id);
CREATE INDEX IF NOT EXISTS marketing_spend_date_idx ON public.marketing_spend(spend_date);
CREATE INDEX IF NOT EXISTS marketing_spend_approval_idx ON public.marketing_spend(approval_status);

INSERT INTO public.marketing_spend (
  id, campaign_id, spend_date, period_start, period_end, amount, description, approval_status, approved_by, approved_at, created_by
) VALUES
  ('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',
   '2026-03-01','2026-03-01','2026-03-31',1850,'March Google Ads — PI search',
   'Approved','0c0874e3-bb59-430f-af15-94e9dab96507',now(),'0c0874e3-bb59-430f-af15-94e9dab96507'),
  ('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000001',
   '2026-04-01','2026-04-01','2026-04-30',1725,'April Google Ads — PI search',
   'Approved','0c0874e3-bb59-430f-af15-94e9dab96507',now(),'0c0874e3-bb59-430f-af15-94e9dab96507'),
  ('d3000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000002',
   '2026-03-15','2026-03-01','2026-03-31',980,'March Google LSA — PI',
   'Approved','0c0874e3-bb59-430f-af15-94e9dab96507',now(),'0c0874e3-bb59-430f-af15-94e9dab96507'),
  ('d3000000-0000-4000-8000-000000000004','d2000000-0000-4000-8000-000000000003',
   '2026-03-01','2026-03-01','2026-03-31',400,'March SEO content / tools',
   'Approved','0c0874e3-bb59-430f-af15-94e9dab96507',now(),'0c0874e3-bb59-430f-af15-94e9dab96507'),
  ('d3000000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000005',
   '2026-03-01','2026-03-01','2026-03-31',750,'March Avvo probate leads',
   'Approved','0c0874e3-bb59-430f-af15-94e9dab96507',now(),'0c0874e3-bb59-430f-af15-94e9dab96507'),
  ('d3000000-0000-4000-8000-000000000006','d2000000-0000-4000-8000-000000000001',
   '2026-05-01','2026-05-01','2026-05-31',1600,'May Google Ads — PI search (submitted)',
   'Submitted',NULL,NULL,'a1000000-0000-4000-8000-000000000005')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Extend matters with attribution
-- ---------------------------------------------------------------------------
ALTER TABLE public.matters
  ADD COLUMN IF NOT EXISTS lead_source_id uuid REFERENCES public.lead_sources(id),
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.marketing_campaigns(id),
  ADD COLUMN IF NOT EXISTS origin_evaluation_id uuid;

-- Soft FK to case_evaluations when that table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='case_evaluations'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'matters_origin_evaluation_id_fkey'
  ) THEN
    ALTER TABLE public.matters
      ADD CONSTRAINT matters_origin_evaluation_id_fkey
      FOREIGN KEY (origin_evaluation_id) REFERENCES public.case_evaluations(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS matters_lead_source_idx ON public.matters(lead_source_id);
CREATE INDEX IF NOT EXISTS matters_campaign_idx ON public.matters(campaign_id);

-- Attribute existing demo matters
UPDATE public.matters SET
  lead_source_id = 'd1000000-0000-4000-8000-000000000001',
  campaign_id = 'd2000000-0000-4000-8000-000000000001'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01' AND lead_source_id IS NULL;

UPDATE public.matters SET
  lead_source_id = 'd1000000-0000-4000-8000-000000000003',
  campaign_id = 'd2000000-0000-4000-8000-000000000003'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02' AND lead_source_id IS NULL;

UPDATE public.matters SET
  lead_source_id = 'd1000000-0000-4000-8000-000000000006',
  campaign_id = 'd2000000-0000-4000-8000-000000000005'
WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03' AND lead_source_id IS NULL;

-- ---------------------------------------------------------------------------
-- Extend case_evaluations when present
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='case_evaluations'
  ) THEN
    ALTER TABLE public.case_evaluations
      ADD COLUMN IF NOT EXISTS lead_source_id uuid REFERENCES public.lead_sources(id),
      ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.marketing_campaigns(id),
      ADD COLUMN IF NOT EXISTS utm_source text,
      ADD COLUMN IF NOT EXISTS utm_medium text,
      ADD COLUMN IF NOT EXISTS utm_campaign text,
      ADD COLUMN IF NOT EXISTS landing_page text,
      ADD COLUMN IF NOT EXISTS tracking_phone text;
  END IF;
END $$;

-- Seed demo evaluations (only if table exists and empty-ish)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='case_evaluations'
  ) THEN
    INSERT INTO public.case_evaluations (
      id, reference_number, first_name, last_name, email, phone,
      practice_area, case_summary, urgency_level, currently_represented,
      referral_source, consent_to_contact, disclaimer_acknowledged,
      evaluation_status, assigned_paralegal_id, assigned_partner_id,
      submitted_by, submitted_at, lead_source_id, campaign_id,
      utm_source, utm_medium, utm_campaign, landing_page, tracking_phone,
      converted_client_id, converted_matter_id, converted_at, converted_by, is_demo_data
    ) VALUES
    ('ce000000-0000-4000-8000-000000000001','CE-2026-4101','Natalie','Vale','nvale@northvale.demo','(662) 555-2001',
     'Personal Injury','Client inquired after a motor vehicle accident via Google search ad. Seeking evaluation of insurance claim and medical documentation.',
     'Soon', false, NULL, true, true, 'Accepted',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e','a1000000-0000-4000-8000-000000000002',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e','2026-02-10 15:00:00+00',
     'd1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',
     'google','cpc','oxford_pi_car_accident','/potential-client','(662) 555-0101',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
     '2026-02-12 16:00:00+00','0c0874e3-bb59-430f-af15-94e9dab96507', true),
    ('ce000000-0000-4000-8000-000000000002','CE-2026-4102','Marcus','Harbor','ops@harborlogistics.demo','(662) 555-2002',
     'Business Law','Vendor contract dispute inquiry from organic search article on business agreements.',
     'Routine', false, NULL, true, true, 'Accepted',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e','0c0874e3-bb59-430f-af15-94e9dab96507',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e','2026-01-20 14:00:00+00',
     'd1000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000003',
     'rebel','organic','business_law_guides','/potential-client',NULL,
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa02','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
     '2026-01-22 15:00:00+00','0c0874e3-bb59-430f-af15-94e9dab96507', true),
    ('ce000000-0000-4000-8000-000000000003','CE-2026-4103','Elena','Cruz','elena.cruz@example.demo','(662) 555-2003',
     'Probate','Probate administration lead purchased from legal directory network.',
     'Soon', false, NULL, true, true, 'Accepted',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e','0c0874e3-bb59-430f-af15-94e9dab96507',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e','2026-02-01 13:00:00+00',
     'd1000000-0000-4000-8000-000000000006','d2000000-0000-4000-8000-000000000005',
     'avvo','cpc','probate_ppl','/potential-client','(662) 555-0106',
     'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa03','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03',
     '2026-02-03 14:00:00+00','0c0874e3-bb59-430f-af15-94e9dab96507', true),
    ('ce000000-0000-4000-8000-000000000004','CE-2026-4201','Sam','Whitfield','sam.w@example.demo','(662) 555-3101',
     'Personal Injury','Rear-end collision inquiry via Local Services Ad call tracking number.',
     'Urgent', false, NULL, true, true, 'Consultation Scheduled',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e','a1000000-0000-4000-8000-000000000002',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e', now() - interval '3 days',
     'd1000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002',
     'google','lsa','oxford_pi_lsa','/potential-client','(662) 555-0102',
     NULL,NULL,NULL,NULL, true),
    ('ce000000-0000-4000-8000-000000000005','CE-2026-4202','Riley','Nguyen','riley.n@example.demo','(662) 555-3102',
     'Personal Injury','New Google Ads lead — under review by intake.',
     'Soon', false, NULL, true, true, 'Under Review',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e','a1000000-0000-4000-8000-000000000002',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e', now() - interval '1 day',
     'd1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',
     'google','cpc','oxford_pi_car_accident','/potential-client','(662) 555-0101',
     NULL,NULL,NULL,NULL, true),
    ('ce000000-0000-4000-8000-000000000006','CE-2026-4203','Jordan','Perez','jordan.p@example.demo','(662) 555-3103',
     'Family Law','Referred by another Oxford attorney for parenting-plan consultation.',
     'Routine', false, 'Attorney Dana Cole (Oxford)', true, true, 'Referred to Partner',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e','a1000000-0000-4000-8000-000000000002',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e', now() - interval '5 days',
     'd1000000-0000-4000-8000-000000000005','d2000000-0000-4000-8000-000000000004',
     'referral','partner','attorney_network','/potential-client',NULL,
     NULL,NULL,NULL,NULL, true),
    ('ce000000-0000-4000-8000-000000000007','CE-2026-4204','Chris','Lang','chris.l@example.demo','(662) 555-3104',
     'Personal Injury','Declined after consult — liability unclear; tracked for CPL accuracy.',
     'Routine', true, NULL, true, true, 'Declined',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e','a1000000-0000-4000-8000-000000000002',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e', now() - interval '12 days',
     'd1000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001',
     'google','cpc','oxford_pi_car_accident','/potential-client','(662) 555-0101',
     NULL,NULL,NULL,NULL, true),
    ('ce000000-0000-4000-8000-000000000008','CE-2026-4205','Avery','Moss','avery.m@example.demo','(662) 555-3105',
     'Employment Law','Organic web lead — contact attempted.',
     'Routine', false, NULL, true, true, 'Contact Attempted',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e','27db10c9-321f-4230-93d7-0221c165d2b9',
     '4d5d7e46-6df3-4bfe-8810-f8d5433ece1e', now() - interval '2 days',
     'd1000000-0000-4000-8000-000000000003',NULL,
     'rebel','organic','employment_basics','/potential-client',NULL,
     NULL,NULL,NULL,NULL, true)
    ON CONFLICT (id) DO NOTHING;

    UPDATE public.matters m SET origin_evaluation_id = e.id
    FROM public.case_evaluations e
    WHERE e.converted_matter_id = m.id AND m.origin_evaluation_id IS NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Update convert_case_evaluation to copy attribution (when intake tables exist)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='case_evaluations'
  ) THEN
    EXECUTE $fn$
CREATE OR REPLACE FUNCTION public.convert_case_evaluation(p_evaluation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $body$
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
    scope_summary, created_by,
    lead_source_id, campaign_id, origin_evaluation_id
  ) VALUES (
    new_client_id, mname,
    left(ev.case_summary, 500),
    practice,
    'Draft', 'Draft',
    ev.assigned_partner_id, ev.assigned_partner_id,
    'Drafted from case evaluation ' || ev.reference_number || '. Internal intake notes were not copied.',
    auth.uid(),
    ev.lead_source_id, ev.campaign_id, ev.id
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
$body$;
$fn$;
    GRANT EXECUTE ON FUNCTION public.convert_case_evaluation(uuid) TO authenticated;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_spend ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_sources_select ON public.lead_sources;
CREATE POLICY lead_sources_select ON public.lead_sources FOR SELECT TO authenticated
  USING (active_status = true OR public.current_profile_role() IN ('managing_partner','billing_staff'));

DROP POLICY IF EXISTS lead_sources_manage ON public.lead_sources;
CREATE POLICY lead_sources_manage ON public.lead_sources FOR ALL TO authenticated
  USING (public.current_profile_role() = 'managing_partner')
  WITH CHECK (public.current_profile_role() = 'managing_partner');

DROP POLICY IF EXISTS mkt_campaigns_select ON public.marketing_campaigns;
CREATE POLICY mkt_campaigns_select ON public.marketing_campaigns FOR SELECT TO authenticated
  USING (public.current_profile_role() IN ('managing_partner','billing_staff','paralegal','attorney'));

DROP POLICY IF EXISTS mkt_campaigns_manage ON public.marketing_campaigns;
CREATE POLICY mkt_campaigns_manage ON public.marketing_campaigns FOR ALL TO authenticated
  USING (public.current_profile_role() IN ('managing_partner','billing_staff'))
  WITH CHECK (public.current_profile_role() IN ('managing_partner','billing_staff'));

DROP POLICY IF EXISTS mkt_spend_select ON public.marketing_spend;
CREATE POLICY mkt_spend_select ON public.marketing_spend FOR SELECT TO authenticated
  USING (public.current_profile_role() IN ('managing_partner','billing_staff'));

DROP POLICY IF EXISTS mkt_spend_insert ON public.marketing_spend;
CREATE POLICY mkt_spend_insert ON public.marketing_spend FOR INSERT TO authenticated
  WITH CHECK (public.current_profile_role() IN ('managing_partner','billing_staff'));

DROP POLICY IF EXISTS mkt_spend_update ON public.marketing_spend;
CREATE POLICY mkt_spend_update ON public.marketing_spend FOR UPDATE TO authenticated
  USING (public.current_profile_role() IN ('managing_partner','billing_staff'))
  WITH CHECK (public.current_profile_role() IN ('managing_partner','billing_staff'));

GRANT SELECT ON public.lead_sources TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketing_spend TO authenticated;
