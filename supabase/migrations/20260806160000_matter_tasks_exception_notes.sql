-- Task completion exception notes (written by TaskCompletionModal / MatterDetail)
-- Applied remotely to ACC628-Final-Project; kept for repo parity.

ALTER TABLE public.matter_tasks
  ADD COLUMN IF NOT EXISTS exception_notes text;

COMMENT ON COLUMN public.matter_tasks.exception_notes IS
  'Client-facing or attorney-visible notes when work completed with an exception or ad hoc variance.';
