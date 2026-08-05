-- Case evaluations / public client intake (fictional academic data)
-- Applied remotely via Supabase MCP; kept here for repo parity.

CREATE TYPE public.case_eval_status AS ENUM (
  'New','Under Review','Contact Attempted','Consultation Scheduled',
  'Referred to Partner','Accepted','Declined','Closed'
);

CREATE TYPE public.case_eval_urgency AS ENUM (
  'Routine','Soon','Urgent','Immediate Deadline'
);

CREATE TABLE public.practice_area_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_area text NOT NULL UNIQUE,
  lead_attorney_id uuid NOT NULL REFERENCES public.profiles(id),
  short_description text NOT NULL,
  client_facing_description text NOT NULL,
  common_needs text[] NOT NULL DEFAULT '{}',
  active_status boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.case_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number text NOT NULL UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  preferred_contact_method text,
  best_contact_time text,
  practice_area text NOT NULL,
  issue_date date,
  city text,
  state text,
  case_summary text NOT NULL,
  urgency_level public.case_eval_urgency NOT NULL DEFAULT 'Routine',
  currently_represented boolean NOT NULL DEFAULT false,
  referral_source text,
  consent_to_contact boolean NOT NULL DEFAULT false,
  disclaimer_acknowledged boolean NOT NULL DEFAULT false,
  evaluation_status public.case_eval_status NOT NULL DEFAULT 'New',
  assigned_paralegal_id uuid REFERENCES public.profiles(id),
  assigned_partner_id uuid REFERENCES public.profiles(id),
  submitted_by uuid REFERENCES public.profiles(id),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  follow_up_due_at timestamptz,
  internal_notes text,
  partner_recommendation text,
  partner_review_notes text,
  decline_reason text,
  converted_client_id uuid REFERENCES public.clients(id),
  converted_matter_id uuid REFERENCES public.matters(id),
  converted_at timestamptz,
  converted_by uuid REFERENCES public.profiles(id),
  is_demo_data boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_eval_contact_chk CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CONSTRAINT case_eval_consent_chk CHECK (consent_to_contact = true AND disclaimer_acknowledged = true)
);

CREATE TABLE public.case_evaluation_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id uuid NOT NULL REFERENCES public.case_evaluations(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  activity_notes text,
  performed_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX case_evaluations_status_idx ON public.case_evaluations(evaluation_status);
CREATE INDEX case_evaluations_paralegal_idx ON public.case_evaluations(assigned_paralegal_id);
CREATE INDEX case_evaluations_partner_idx ON public.case_evaluations(assigned_partner_id);
CREATE INDEX case_evaluations_submitted_idx ON public.case_evaluations(submitted_at DESC);
CREATE INDEX case_eval_activity_eval_idx ON public.case_evaluation_activity(evaluation_id, created_at DESC);

INSERT INTO public.practice_area_leads (practice_area, lead_attorney_id, short_description, client_facing_description, common_needs, display_order) VALUES
('Personal Injury','a1000000-0000-4000-8000-000000000002',
 'Help after accidents and unexpected injuries.',
 'Rebel Law Group guides injured clients through insurance claims, medical documentation, and settlement discussions with clear, practical advice.',
 ARRAY['Motor vehicle accidents','Slip and fall','Insurance claim questions','Medical expense recovery'],10),
('Business Law','a1000000-0000-4000-8000-000000000001',
 'Practical counsel for Oxford businesses.',
 'From formation to growth, we help local businesses organize, negotiate, and manage day-to-day legal needs.',
 ARRAY['Business formation','Operating agreements','Governance advice','Ownership transitions'],20),
('Contract Law','a1000000-0000-4000-8000-000000000003',
 'Clear contracts that protect your interests.',
 'We draft and review agreements so individuals and businesses understand their rights and obligations before signing.',
 ARRAY['Contract review','Vendor agreements','Service contracts','Negotiation support'],30),
('Employment Law','a1000000-0000-4000-8000-000000000003',
 'Workplace guidance for employers and employees.',
 'Rebel Law Group helps clients understand workplace policies, employment agreements, and practical next steps.',
 ARRAY['Employment agreements','Workplace policies','Severance questions','HR compliance basics'],40),
('Family Law','a1000000-0000-4000-8000-000000000002',
 'Supportive counsel for family transitions.',
 'We provide respectful guidance for family legal needs with an emphasis on clarity and stability.',
 ARRAY['Family transitions','Parenting plans','Support questions','Name changes'],50),
('Estate Planning','a1000000-0000-4000-8000-000000000001',
 'Plan thoughtfully for the people you care about.',
 'Wills, powers of attorney, and practical estate plans designed for Oxford families and professionals.',
 ARRAY['Wills','Powers of attorney','Healthcare directives','Simple trusts'],60),
('Probate','a1000000-0000-4000-8000-000000000001',
 'Guidance through estate administration.',
 'We help families navigate probate steps with organized communication and careful attention to detail.',
 ARRAY['Opening an estate','Asset inventory','Creditor notices','Final distribution'],70),
('Real Estate','a1000000-0000-4000-8000-000000000003',
 'Local counsel for property transactions.',
 'Buying, selling, or leasing property in Oxford and surrounding communities with careful document review.',
 ARRAY['Purchase agreements','Lease review','Closing questions','Title issues'],80),
('Criminal Defense','a1000000-0000-4000-8000-000000000002',
 'Steady representation when stakes are high.',
 'We provide confidential, respectful guidance for individuals facing criminal charges or investigations.',
 ARRAY['Misdemeanor defense','First appearances','Charge review','Court preparation'],90),
('Civil Litigation','a1000000-0000-4000-8000-000000000003',
 'Advocacy for civil disputes.',
 'When negotiation is not enough, we help clients evaluate options and pursue or defend civil claims.',
 ARRAY['Business disputes','Contract breaches','Property disputes','Demand letters'],100);

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.profiles WHERE id = auth.uid();
$$;

ALTER TABLE public.practice_area_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_evaluation_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY pal_select ON public.practice_area_leads FOR SELECT TO authenticated
  USING (active_status = true OR public.current_profile_role() IN ('managing_partner','billing_staff'));
CREATE POLICY pal_manage ON public.practice_area_leads FOR ALL TO authenticated
  USING (public.current_profile_role() = 'managing_partner')
  WITH CHECK (public.current_profile_role() = 'managing_partner');

CREATE POLICY ce_insert ON public.case_evaluations FOR INSERT TO authenticated
  WITH CHECK (consent_to_contact = true AND disclaimer_acknowledged = true);

CREATE POLICY ce_select_partner ON public.case_evaluations FOR SELECT TO authenticated
  USING (public.current_profile_role() = 'managing_partner');

CREATE POLICY ce_select_paralegal ON public.case_evaluations FOR SELECT TO authenticated
  USING (
    public.current_profile_role() = 'paralegal'
    AND (assigned_paralegal_id = auth.uid() OR assigned_paralegal_id IS NULL)
  );

CREATE POLICY ce_select_attorney ON public.case_evaluations FOR SELECT TO authenticated
  USING (
    public.current_profile_role() = 'attorney'
    AND assigned_partner_id = auth.uid()
  );

CREATE POLICY ce_select_own ON public.case_evaluations FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

CREATE POLICY ce_update_paralegal ON public.case_evaluations FOR UPDATE TO authenticated
  USING (
    public.current_profile_role() = 'paralegal'
    AND (assigned_paralegal_id = auth.uid() OR assigned_paralegal_id IS NULL)
  )
  WITH CHECK (
    public.current_profile_role() = 'paralegal'
    AND converted_matter_id IS NULL
  );

CREATE POLICY ce_update_attorney ON public.case_evaluations FOR UPDATE TO authenticated
  USING (public.current_profile_role() = 'attorney' AND assigned_partner_id = auth.uid())
  WITH CHECK (public.current_profile_role() = 'attorney' AND assigned_partner_id = auth.uid());

CREATE POLICY ce_update_partner ON public.case_evaluations FOR UPDATE TO authenticated
  USING (public.current_profile_role() = 'managing_partner')
  WITH CHECK (public.current_profile_role() = 'managing_partner');

CREATE POLICY cea_insert ON public.case_evaluation_activity FOR INSERT TO authenticated
  WITH CHECK (
    public.current_profile_role() IN ('managing_partner','paralegal','attorney')
    OR performed_by = auth.uid()
  );

CREATE POLICY cea_select ON public.case_evaluation_activity FOR SELECT TO authenticated
  USING (
    public.current_profile_role() = 'managing_partner'
    OR EXISTS (
      SELECT 1 FROM public.case_evaluations e
      WHERE e.id = evaluation_id
        AND (
          e.assigned_paralegal_id = auth.uid()
          OR e.assigned_partner_id = auth.uid()
          OR e.submitted_by = auth.uid()
        )
    )
  );

GRANT SELECT ON public.practice_area_leads TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.case_evaluations TO authenticated;
GRANT SELECT, INSERT ON public.case_evaluation_activity TO authenticated;

-- See follow-up migration for triggers + convert_case_evaluation()
