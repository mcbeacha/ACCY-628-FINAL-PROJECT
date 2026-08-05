-- Add billing_code to time_entries for matter+activity codes (e.g. MT-05001-1002).
-- Run on the live ACCY628 Supabase project used by Vercel/local (.env.local).

alter table public.time_entries
  add column if not exists billing_code text;

comment on column public.time_entries.billing_code is
  'Auto-built matter billing code: {matter_number}-{activity_code}';
