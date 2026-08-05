-- Cost and Resource Tracking expansion (academic / fictional data)
-- Part 1: schema

-- Matter budget breakdown
ALTER TABLE public.matters
  ADD COLUMN IF NOT EXISTS planned_labor_hours numeric(12,2) CHECK (planned_labor_hours IS NULL OR planned_labor_hours >= 0),
  ADD COLUMN IF NOT EXISTS planned_labor_cost numeric(14,2) CHECK (planned_labor_cost IS NULL OR planned_labor_cost >= 0),
  ADD COLUMN IF NOT EXISTS planned_vendor_cost numeric(14,2) CHECK (planned_vendor_cost IS NULL OR planned_vendor_cost >= 0),
  ADD COLUMN IF NOT EXISTS planned_direct_expense_cost numeric(14,2) CHECK (planned_direct_expense_cost IS NULL OR planned_direct_expense_cost >= 0),
  ADD COLUMN IF NOT EXISTS planned_allocated_cost numeric(14,2) CHECK (planned_allocated_cost IS NULL OR planned_allocated_cost >= 0);

-- Vendors / contractors
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_number text NOT NULL UNIQUE,
  vendor_name text NOT NULL,
  vendor_type text NOT NULL CHECK (vendor_type IN (
    'Outside Counsel','Expert Witness','Investigator','Court Reporter','Consultant',
    'Medical Records Provider','Research Provider','Travel Provider','Filing Service','Other'
  )),
  primary_contact text,
  email text,
  phone text,
  address text,
  active_status boolean NOT NULL DEFAULT true,
  default_rate numeric(12,2) CHECK (default_rate IS NULL OR default_rate >= 0),
  payment_terms text,
  tax_information_status text NOT NULL DEFAULT 'Not Required'
    CHECK (tax_information_status IN ('Not Required','Missing','Received','Verified')),
  approved_vendor_status boolean NOT NULL DEFAULT false,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  is_demo_data boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Cost categories
CREATE TABLE IF NOT EXISTS public.cost_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL UNIQUE,
  category_group text NOT NULL CHECK (category_group IN (
    'Employee Labor','Outside Services','Legal and Matter Expenses','Travel','Allocated Costs','Other'
  )),
  default_reimbursable_status boolean NOT NULL DEFAULT false,
  requires_receipt boolean NOT NULL DEFAULT false,
  requires_approval boolean NOT NULL DEFAULT true,
  active_status boolean NOT NULL DEFAULT true,
  is_demo_data boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Expanded matter resources (employees + vendors)
CREATE TABLE IF NOT EXISTS public.matter_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.matters(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN (
    'Managing Partner','Attorney','Paralegal','Legal Assistant','Billing or Accounting Staff',
    'Outside Counsel','Expert Witness','Investigator','Court Reporter','Consultant',
    'Medical Records Provider','Vendor','Other Contractor'
  )),
  employee_id uuid REFERENCES public.profiles(id),
  vendor_id uuid REFERENCES public.vendors(id),
  assignment_role text NOT NULL CHECK (assignment_role IN (
    'Lead Attorney','Supporting Attorney','Paralegal','Legal Assistant','Billing Contact',
    'Outside Counsel','Expert Witness','Investigator','Consultant','Other'
  )),
  assigned_date date NOT NULL DEFAULT CURRENT_DATE,
  expected_end_date date,
  planned_hours numeric(12,2) CHECK (planned_hours IS NULL OR planned_hours >= 0),
  planned_cost numeric(14,2) CHECK (planned_cost IS NULL OR planned_cost >= 0),
  approved_budget numeric(14,2) CHECK (approved_budget IS NULL OR approved_budget >= 0),
  active_status boolean NOT NULL DEFAULT true,
  assigned_by uuid REFERENCES public.profiles(id),
  is_demo_data boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matter_resources_one_party CHECK (
    (employee_id IS NOT NULL AND vendor_id IS NULL)
    OR (employee_id IS NULL AND vendor_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS matter_resources_active_employee_uq
  ON public.matter_resources (matter_id, employee_id)
  WHERE active_status AND employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS matter_resources_active_vendor_uq
  ON public.matter_resources (matter_id, vendor_id)
  WHERE active_status AND vendor_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS matter_resources_one_lead_attorney_uq
  ON public.matter_resources (matter_id)
  WHERE active_status AND assignment_role = 'Lead Attorney';

-- Cost allocations (header)
CREATE TABLE IF NOT EXISTS public.cost_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_number text NOT NULL UNIQUE,
  description text NOT NULL,
  cost_category_id uuid REFERENCES public.cost_categories(id),
  shared_cost_amount numeric(14,2) NOT NULL CHECK (shared_cost_amount > 0),
  allocation_method text NOT NULL CHECK (allocation_method IN (
    'Equal','Percentage','Attorney Hours','Matter Revenue','Manual'
  )),
  allocation_date date NOT NULL DEFAULT CURRENT_DATE,
  approval_status text NOT NULL DEFAULT 'Draft'
    CHECK (approval_status IN ('Draft','Submitted','Approved','Rejected')),
  prepared_by uuid REFERENCES public.profiles(id),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  approval_notes text,
  rejection_reason text,
  total_allocated numeric(14,2) NOT NULL DEFAULT 0,
  unallocated_remainder numeric(14,2) NOT NULL DEFAULT 0,
  is_demo_data boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cost_allocation_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id uuid NOT NULL REFERENCES public.cost_allocations(id) ON DELETE CASCADE,
  matter_id uuid NOT NULL REFERENCES public.matters(id),
  allocation_amount numeric(14,2) NOT NULL CHECK (allocation_amount >= 0),
  allocation_percent numeric(8,4),
  notes text,
  is_demo_data boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (allocation_id, matter_id)
);

-- Unified cost entries for vendor / allocation / manual (time & expenses stay in their tables)
CREATE TABLE IF NOT EXISTS public.matter_cost_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matter_id uuid NOT NULL REFERENCES public.matters(id),
  client_id uuid NOT NULL REFERENCES public.clients(id),
  cost_date date NOT NULL DEFAULT CURRENT_DATE,
  cost_category_id uuid REFERENCES public.cost_categories(id),
  cost_source text NOT NULL CHECK (cost_source IN (
    'Time Entry','Employee Labor','Vendor Invoice','Contractor Charge',
    'Expense Entry','Travel','Allocation','Manual Adjustment'
  )),
  employee_id uuid REFERENCES public.profiles(id),
  vendor_id uuid REFERENCES public.vendors(id),
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit_cost numeric(14,4) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost numeric(14,2) NOT NULL CHECK (total_cost >= 0),
  client_reimbursable boolean NOT NULL DEFAULT false,
  expected_client_charge numeric(14,2) NOT NULL DEFAULT 0 CHECK (expected_client_charge >= 0),
  approval_status text NOT NULL DEFAULT 'Draft'
    CHECK (approval_status IN ('Draft','Submitted','Approved','Rejected')),
  billing_status text NOT NULL DEFAULT 'Unbilled'
    CHECK (billing_status IN ('Not Billable','Unbilled','Selected for Billing','Billed')),
  payment_status text NOT NULL DEFAULT 'Not Applicable'
    CHECK (payment_status IN ('Not Applicable','Unpaid','Partially Paid','Paid')),
  receipt_reference text,
  is_closing_adjustment boolean NOT NULL DEFAULT false,
  closing_adjustment_reason text,
  duplicate_override boolean NOT NULL DEFAULT false,
  duplicate_override_by uuid REFERENCES public.profiles(id),
  allocation_id uuid REFERENCES public.cost_allocations(id),
  self_approval_flag boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  submitted_by uuid REFERENCES public.profiles(id),
  submitted_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  approval_notes text,
  rejection_reason text,
  is_demo_data boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Block exact duplicate vendor invoice refs unless override
CREATE UNIQUE INDEX IF NOT EXISTS matter_cost_vendor_invoice_uq
  ON public.matter_cost_entries (vendor_id, receipt_reference)
  WHERE vendor_id IS NOT NULL
    AND receipt_reference IS NOT NULL
    AND receipt_reference <> ''
    AND duplicate_override = false
    AND cost_source IN ('Vendor Invoice','Contractor Charge');

CREATE INDEX IF NOT EXISTS matter_cost_entries_matter_idx ON public.matter_cost_entries (matter_id);
CREATE INDEX IF NOT EXISTS matter_cost_entries_approval_idx ON public.matter_cost_entries (approval_status);
CREATE INDEX IF NOT EXISTS matter_resources_matter_idx ON public.matter_resources (matter_id);
