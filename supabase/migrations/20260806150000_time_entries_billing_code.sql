-- Add billing_code to time_entries for matter+activity codes (e.g. MT-05001-1002).
-- Applied remotely to ACC628-Final-Project; kept for repo parity.

alter table public.time_entries
  add column if not exists billing_code text;

comment on column public.time_entries.billing_code is
  'Auto-built matter billing code: {matter_number}-{activity_code}';
