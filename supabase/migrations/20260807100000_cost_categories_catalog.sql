-- Full cost_categories catalog for Cost Entry / Vendor Charge / Allocations.
-- Keeps Advertising / Marketing (d400…0001). Safe to re-run via ON CONFLICT.

INSERT INTO public.cost_categories (
  id,
  category_name,
  category_group,
  default_reimbursable_status,
  requires_receipt,
  requires_approval,
  active_status,
  is_demo_data
) VALUES
  -- Employee Labor
  (
    'd4000000-0000-4000-8000-000000000002',
    'Contract / Temp Staff',
    'Employee Labor',
    false, false, true, true, true
  ),
  -- Outside Services
  (
    'd4000000-0000-4000-8000-000000000010',
    'Outside Counsel',
    'Outside Services',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000011',
    'Expert Witness',
    'Outside Services',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000012',
    'Court Reporter / Deposition',
    'Outside Services',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000013',
    'Investigator',
    'Outside Services',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000014',
    'Consultant',
    'Outside Services',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000015',
    'Medical Records Provider',
    'Outside Services',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000016',
    'Filing Service',
    'Outside Services',
    true, true, true, true, true
  ),
  -- Legal and Matter Expenses
  (
    'd4000000-0000-4000-8000-000000000020',
    'Filing / Court Fees',
    'Legal and Matter Expenses',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000021',
    'Medical Records',
    'Legal and Matter Expenses',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000022',
    'Research Databases',
    'Legal and Matter Expenses',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000023',
    'Copying / Printing',
    'Legal and Matter Expenses',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000024',
    'Postage / Delivery',
    'Legal and Matter Expenses',
    true, true, true, true, true
  ),
  -- Travel
  (
    'd4000000-0000-4000-8000-000000000030',
    'Airfare / Transit',
    'Travel',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000031',
    'Lodging',
    'Travel',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000032',
    'Meals & Entertainment',
    'Travel',
    true, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000033',
    'Mileage / Parking',
    'Travel',
    true, true, true, true, true
  ),
  -- Allocated Costs (Advertising / Marketing already seeded by marketing migration)
  (
    'd4000000-0000-4000-8000-000000000001',
    'Advertising / Marketing',
    'Allocated Costs',
    false, true, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000040',
    'Office Overhead',
    'Allocated Costs',
    false, false, true, true, true
  ),
  (
    'd4000000-0000-4000-8000-000000000041',
    'Technology / Software',
    'Allocated Costs',
    false, true, true, true, true
  ),
  -- Other
  (
    'd4000000-0000-4000-8000-000000000050',
    'Other / Miscellaneous',
    'Other',
    false, false, true, true, true
  )
ON CONFLICT (category_name) DO UPDATE SET
  category_group = EXCLUDED.category_group,
  default_reimbursable_status = EXCLUDED.default_reimbursable_status,
  requires_receipt = EXCLUDED.requires_receipt,
  requires_approval = EXCLUDED.requires_approval,
  active_status = EXCLUDED.active_status;
