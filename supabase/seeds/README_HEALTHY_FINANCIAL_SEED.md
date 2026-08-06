# Healthy financial seed data (Rebel Law Group)

This academic demo’s financial seed data lives primarily in the remote Supabase project (`xrsueubqclxddbbnntfu`). There is no separate competing local seed runner.

## Attorney workspace prior data (Jordan Harper)

Idempotent seed for the attorney demo profile only (`jharper@rebellaw.demo` / `a1000000-0000-4000-8000-000000000002`):

- File: [`attorney_jordan_harper_workspace.sql`](attorney_jordan_harper_workspace.sql)
- Inserts/updates `matter_tasks`, `matter_activity`, and court/filing dates on matters linked to Jordan (prefers `MT-2001` / `MT-2003` / `MT-2002`, else `MT-0500x` when present)
- Safe to re-run (`af10…` stable UUIDs + `ON CONFLICT`)

Apply in the Supabase SQL Editor against the demo project your app uses, or via MCP `execute_sql` / `apply_migration` when that project is linked.

## Lane Kiffin — informational Criminal Defense AR (not a demo identity)

Idempotent seed for a **data-only** client who does **not** appear in Demo Mode “View App As”:

- File: [`lane_kiffin_criminal_ar.sql`](lane_kiffin_criminal_ar.sql)
- Client: Lane Kiffin (`e110…0001`), Individual / Active, `portal_user_id` NULL (no Auth / portal login)
- Matter: `State v. Kiffin — Murder Defense`, practice area **Criminal Defense**, Fixed Fee $350,000, Lead Attorney Jordan Harper
- Invoice: `INV-LK-350000`, finalized, `balance_due = 350000`, due date ~75 days past → shows as past-due AR
- Safe to re-run (`e110…` stable hex UUIDs + `ON CONFLICT`)
- **Do not** add this person to `DEMO_IDENTITIES` in `src/lib/demo-config.ts`

Apply in the Supabase SQL Editor against the demo project, or via MCP `execute_sql` when linked. Matter insert briefly disables `trg_matter_controls` if that trigger exists.

## Dashboard edge-case seed (demo clients untouched)

Idempotent seed for **additional informational clients/matters/invoices** used by dashboards and AR. Does **not** update Demo Mode identities or known demo rows (Northvale/Nora, MT-200x, INV-0100xx, etc.).

- File: [`dashboard_edge_case_seed.sql`](dashboard_edge_case_seed.sql)
- UUID prefix: `e120…` / `e121…` / `e122…` (hex-valid)
- Covers: unprofitable contracts, late projects, over-budget work, unpaid invoices, partial payments, canceled contracts, renewals, change orders, disputed charges, expired agreements, work before approval, costs after billing, plus a broader client history
- Safe to re-run (`ON CONFLICT`); never sets `portal_user_id`; leave `DEMO_IDENTITIES` unchanged

Apply in the Supabase SQL Editor for project `xhrsitxkmyczocvdhyev` (or your linked demo project).

## Cost categories catalog

Cost Entry / Vendor Charge / Allocations load categories from `public.cost_categories` (not from app constants). The full catalog is seeded by migration:

- File: [`../migrations/20260807100000_cost_categories_catalog.sql`](../migrations/20260807100000_cost_categories_catalog.sql)
- Keeps **Advertising / Marketing** (`d400…0001`) for marketing ROI posting
- Adds Outside Services, Legal and Matter Expenses, Travel, Allocated Costs, Employee Labor, and Other names so dropdowns are not limited to marketing
- Safe to re-run (`ON CONFLICT (category_name) DO UPDATE`)

`dashboard_edge_case_seed.sql` looks up the first active row in `Outside Services` and `Legal and Matter Expenses`; those groups are populated by this catalog.

## How seed data was revised

Revisions were applied as idempotent remote migrations via the Supabase MCP (`apply_migration`), using stable demo UUIDs and `ON CONFLICT` upserts where practical.

Named remote migrations applied for this revision (among others):

- `healthy_seed_costs_and_matters` — expense/vendor/allocation cuts, matter activation, budgets, retainers
- `healthy_seed_invoices_payments` — existing invoice status/total cleanup, small write-off
- `healthy_seed_new_invoices` — INV-010008…016 (`Other` / `Fixed Fee` lines)
- `healthy_seed_costs_time_ar` — matter dates, extra approved time, AR due-date mix
- `healthy_seed_payments` — payment + application rows aligned to invoice `payments_applied`
- `healthy_seed_journals` / `healthy_seed_journal_lines` — balanced JE headers/lines
- `healthy_seed_ar_margin_tweak` — PI vendor tweak, partial collections for AR mix
- `healthy_seed_fix_invoice_payment_map` — corrected UUID↔invoice_number quirk for INV-010004/006
- `healthy_seed_productivity_capacity` — `profiles.available_weekly_hours` for believable utilization
- `fix_inv010006_reconciliation.sql` — INV-010006 historical note (superseded by settlement trust fix below for retainer detach)
- `fix_pi_trust_settlement_ledger.sql` — MT-05002 Client Trust settlement chain (proceeds → lien → costs → fees → client); INV-010006 payment $700 / retainer $0 / balance $350; Trust Ledger UI filters to PI only

## Important ID quirk

Demo invoice UUIDs do **not** always match invoice numbers:

| invoice_number | id suffix |
|---|---|
| INV-010004 | `...000006` |
| INV-010006 | `...000004` |

Always join/filter by `invoice_number` when editing seeds.

## Tiny app supporting fix

Unfiltered attorney utilization previously used a hard-coded **12-week** denominator, which made healthy utilization impossible without unrealistic hour volumes. Default window is now **4 weeks** in `src/lib/analytics.ts` (`weeksInRange`), with matching help text on the productivity page. Formulas for revenue, cost, and profit were not changed.

## Re-run guidance

1. Prefer re-applying the same idempotent SQL (stable IDs + `ON CONFLICT`) against the demo project.
2. Do not truncate unknown tables; only upsert/update clearly identified demo UUID ranges (`a100…`, `b200…`, `c300…`, `aa00…`, `bb00…`, `e500…`, `e110…`, `ce00…`, `cf00…`, etc.).
3. Matter status/approval updates may require briefly disabling `trg_matter_controls` (Managing Partner approval gate), then re-enabling it.
4. After data changes, refresh dashboards/reports in the app — totals are calculated from DB rows, not hardcoded UI figures.
5. Always re-run `supabase/seeds/ensure_mt05002_active_approved.sql` after financial re-seeds so PI matter **MT-05002** stays `matter_status = Active` and `approval_status = Approved` (it already has invoices, payments, retainers, write-offs, and contingency journal activity). Do not leave it `Pending Approval` while those rows exist.

## Pro bono

`MT-05007` (Volunteer Festival Permit Support) remains Closed with no commercial revenue and is excluded from normal commercial profitability rankings in verification queries.
