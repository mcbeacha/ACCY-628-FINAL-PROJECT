import type { Profile } from "@/lib/types";

export type VendorType =
  | "Outside Counsel"
  | "Expert Witness"
  | "Investigator"
  | "Court Reporter"
  | "Consultant"
  | "Medical Records Provider"
  | "Research Provider"
  | "Travel Provider"
  | "Filing Service"
  | "Other";

export type TaxInfoStatus = "Not Required" | "Missing" | "Received" | "Verified";

export type CostCategoryGroup =
  | "Employee Labor"
  | "Outside Services"
  | "Legal and Matter Expenses"
  | "Travel"
  | "Allocated Costs"
  | "Other";

export type CostSource =
  | "Time Entry"
  | "Employee Labor"
  | "Vendor Invoice"
  | "Contractor Charge"
  | "Expense Entry"
  | "Travel"
  | "Allocation"
  | "Manual Adjustment";

export type CostApprovalStatus = "Draft" | "Submitted" | "Approved" | "Rejected";
export type CostBillingStatus =
  | "Not Billable"
  | "Unbilled"
  | "Selected for Billing"
  | "Billed";
export type CostPaymentStatus =
  | "Not Applicable"
  | "Unpaid"
  | "Partially Paid"
  | "Paid";

export type AllocationMethod =
  | "Equal"
  | "Percentage"
  | "Attorney Hours"
  | "Matter Revenue"
  | "Manual";

export type Vendor = {
  id: string;
  vendor_number: string;
  vendor_name: string;
  vendor_type: VendorType;
  primary_contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  active_status: boolean;
  default_rate: number | null;
  payment_terms: string | null;
  tax_information_status: TaxInfoStatus;
  approved_vendor_status: boolean;
  approved_by: string | null;
  approved_at: string | null;
  is_demo_data: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CostCategory = {
  id: string;
  category_name: string;
  category_group: CostCategoryGroup;
  default_reimbursable_status: boolean;
  requires_receipt: boolean;
  requires_approval: boolean;
  active_status: boolean;
};

export type MatterResource = {
  id: string;
  matter_id: string;
  resource_type: string;
  employee_id: string | null;
  vendor_id: string | null;
  assignment_role: string;
  assigned_date: string;
  expected_end_date: string | null;
  planned_hours: number | null;
  planned_cost: number | null;
  approved_budget: number | null;
  active_status: boolean;
  assigned_by: string | null;
  profiles?: Profile | null;
  vendors?: Vendor | null;
};

export type MatterCostEntry = {
  id: string;
  matter_id: string;
  client_id: string;
  cost_date: string;
  cost_category_id: string | null;
  cost_source: CostSource;
  employee_id: string | null;
  vendor_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  client_reimbursable: boolean;
  expected_client_charge: number;
  approval_status: CostApprovalStatus;
  billing_status: CostBillingStatus;
  payment_status: CostPaymentStatus;
  receipt_reference: string | null;
  is_closing_adjustment: boolean;
  closing_adjustment_reason: string | null;
  duplicate_override: boolean;
  allocation_id: string | null;
  self_approval_flag: boolean;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  cost_categories?: CostCategory | null;
  vendors?: Vendor | null;
  profiles?: Profile | null;
};

export type UnifiedCostRow = {
  id: string;
  matter_id: string;
  client_id: string;
  cost_date: string;
  category_name: string;
  category_group: string;
  cost_source: string;
  employee_id: string | null;
  vendor_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  client_reimbursable: boolean;
  expected_client_charge: number;
  approval_status: string;
  billing_status: string;
  payment_status: string;
  receipt_reference: string | null;
  source_table: string;
};

export type CostAllocation = {
  id: string;
  allocation_number: string;
  description: string;
  cost_category_id: string | null;
  shared_cost_amount: number;
  allocation_method: AllocationMethod;
  allocation_date: string;
  approval_status: CostApprovalStatus;
  prepared_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  total_allocated: number;
  unallocated_remainder: number;
  cost_allocation_lines?: CostAllocationLine[];
};

export type CostAllocationLine = {
  id: string;
  allocation_id: string;
  matter_id: string;
  allocation_amount: number;
  allocation_percent: number | null;
  notes: string | null;
};

export const VENDOR_TYPES: VendorType[] = [
  "Outside Counsel",
  "Expert Witness",
  "Investigator",
  "Court Reporter",
  "Consultant",
  "Medical Records Provider",
  "Research Provider",
  "Travel Provider",
  "Filing Service",
  "Other",
];

export const COST_SOURCES: CostSource[] = [
  "Vendor Invoice",
  "Contractor Charge",
  "Travel",
  "Manual Adjustment",
  "Employee Labor",
];

export const ALLOCATION_METHODS: AllocationMethod[] = [
  "Equal",
  "Percentage",
  "Attorney Hours",
  "Matter Revenue",
  "Manual",
];

export const RESOURCE_ASSIGNMENT_ROLES = [
  "Lead Attorney",
  "Supporting Attorney",
  "Paralegal",
  "Legal Assistant",
  "Billing Contact",
  "Outside Counsel",
  "Expert Witness",
  "Investigator",
  "Consultant",
  "Other",
] as const;

export const HIGH_VALUE_COST_THRESHOLD = 1000;
