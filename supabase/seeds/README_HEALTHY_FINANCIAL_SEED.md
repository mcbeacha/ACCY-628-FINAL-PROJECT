# Healthy financial seed data (Rebel Law Group)

This academic demo’s financial seed data lives primarily in the remote Supabase project (`xrsueubqclxddbbnntfu`). There is no separate competing local seed runner.

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
2. Do not truncate unknown tables; only upsert/update clearly identified demo UUID ranges (`a100…`, `b200…`, `c300…`, `aa00…`, `bb00…`, `e500…`, `ce00…`, `cf00…`, etc.).
3. Matter status/approval updates may require briefly disabling `trg_matter_controls` (Managing Partner approval gate), then re-enabling it.
4. After data changes, refresh dashboards/reports in the app — totals are calculated from DB rows, not hardcoded UI figures.

## Pro bono

`MT-05007` (Volunteer Festival Permit Support) remains Closed with no commercial revenue and is excluded from normal commercial profitability rankings in verification queries.
