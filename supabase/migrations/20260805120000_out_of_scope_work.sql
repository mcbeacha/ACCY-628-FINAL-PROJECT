-- Out-of-scope / ad hoc work flag (ACCY 628 §5.3 + unauthorized work control)
-- Time: attorney approval required before billing (invoice prep uses Approved only).
-- Tasks: flag on complete for attorney awareness.

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS out_of_scope boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS out_of_scope_reason text;

ALTER TABLE public.matter_tasks
  ADD COLUMN IF NOT EXISTS out_of_scope boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.time_entries.out_of_scope IS
  'True when work was not in the original assignment; requires attorney authorization before billing.';
COMMENT ON COLUMN public.time_entries.out_of_scope_reason IS
  'Why the time was outside the original assignment.';
COMMENT ON COLUMN public.matter_tasks.out_of_scope IS
  'True when completed work was ad hoc / outside original task assignment.';
