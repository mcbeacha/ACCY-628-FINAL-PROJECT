export type UserRole =
  | "managing_partner"
  | "attorney"
  | "paralegal"
  | "billing_staff"
  | "client";

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  job_title: string | null;
  active_status: boolean;
  available_weekly_hours?: number | null;
  created_at: string;
  updated_at?: string;
};

export type Client = {
  id: string;
  client_number: string;
  client_type: "Individual" | "Business" | "Nonprofit" | "Government" | "Other";
  first_name: string | null;
  last_name: string | null;
  organization_name: string | null;
  primary_contact_name: string | null;
  email: string | null;
  phone: string | null;
  billing_email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  client_status: "Prospective" | "Active" | "Inactive" | "Closed";
  portal_user_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string;
};

export type Matter = {
  id: string;
  matter_number: string;
  client_id: string;
  matter_name: string;
  matter_description: string | null;
  practice_area: string;
  matter_status: string;
  engagement_start_date: string | null;
  expected_end_date: string | null;
  actual_close_date: string | null;
  responsible_attorney_id: string | null;
  originating_attorney_id: string | null;
  billing_method: string | null;
  hourly_rate: number | null;
  fixed_fee_amount: number | null;
  contingency_percentage: number | null;
  initial_retainer_amount: number | null;
  retainer_replenishment_threshold: number | null;
  estimated_matter_value: number | null;
  matter_budget: number | null;
  planned_labor_hours?: number | null;
  planned_labor_cost?: number | null;
  planned_vendor_cost?: number | null;
  planned_direct_expense_cost?: number | null;
  planned_allocated_cost?: number | null;
  billing_frequency: string | null;
  payment_terms_days: number | null;
  scope_summary: string | null;
  exclusions_summary: string | null;
  termination_terms: string | null;
  renewal_terms: string | null;
  change_approval_required: boolean;
  client_approval_required: boolean;
  approval_status: string;
  approval_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string;
  lead_source_id?: string | null;
  campaign_id?: string | null;
  origin_evaluation_id?: string | null;
  clients?: Client | null;
  responsible?: Profile | null;
  originating?: Profile | null;
};

export type MatterAssignment = {
  id: string;
  matter_id: string;
  user_id: string;
  assignment_role: string;
  assigned_at: string;
  assigned_by: string | null;
  active_status: boolean;
  profiles?: Profile | null;
};

export type MatterTask = {
  id: string;
  matter_id: string;
  task_title: string;
  task_description: string | null;
  assigned_to: string | null;
  task_status: string;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  client_visible: boolean;
  internal_notes: string | null;
  completion_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string;
  matters?: Matter | null;
  assignee?: Profile | null;
};

export type MatterActivity = {
  id: string;
  matter_id: string | null;
  client_id: string | null;
  action_type: string;
  action_description: string;
  performed_by: string | null;
  created_at: string;
  performer?: Profile | null;
};
