"use client";

import { FormEvent, useEffect, useState } from "react";

export type TaskCompletionResult = {
  completion_notes: string;
  exception_notes: string | null;
  out_of_scope: boolean;
};

export function TaskCompletionModal({
  open,
  taskTitle,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  taskTitle: string;
  onCancel: () => void;
  onConfirm: (result: TaskCompletionResult) => void;
}) {
  const [workDone, setWorkDone] = useState("");
  const [exception, setException] = useState("");
  const [outOfScope, setOutOfScope] = useState(false);
  const [oosReason, setOosReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setWorkDone("");
      setException("");
      setOutOfScope(false);
      setOosReason("");
      setError(null);
    }
  }, [open, taskTitle]);

  if (!open) return null;

  function submit(e: FormEvent) {
    e.preventDefault();
    const notes = workDone.trim();
    if (notes.length < 10) {
      setError("Describe the work performed (at least a short sentence).");
      return;
    }
    if (outOfScope && !oosReason.trim()) {
      setError("Explain why this work was outside the original assignment.");
      return;
    }
    const exceptionParts = [
      exception.trim() || null,
      outOfScope ? `Out-of-scope / ad hoc: ${oosReason.trim()}` : null,
    ].filter(Boolean);
    onConfirm({
      completion_notes: notes,
      exception_notes: exceptionParts.length ? exceptionParts.join(" | ") : null,
      out_of_scope: outOfScope,
    });
  }

  return (
    <dialog className="modal modal-open">
      <div className="modal-box max-w-lg">
        <h3 className="font-display text-lg font-semibold">Document work performed</h3>
        <p className="text-sm opacity-70 mt-1">
          Completing <span className="font-medium">{taskTitle}</span>. Record what you did before
          marking this task complete.
        </p>

        <form className="mt-4 space-y-4" onSubmit={submit}>
          <label className="form-control w-full">
            <span className="label-text font-semibold text-sm">
              Work performed <span className="text-error">*</span>
            </span>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={4}
              value={workDone}
              onChange={(e) => setWorkDone(e.target.value)}
              placeholder="Example: Requested medical records from Baptist Memorial and confirmed receipt of imaging CD."
              required
              autoFocus
            />
            <span className="label-text-alt opacity-60">
              Required — documents that the assigned worker completed the activity.
            </span>
          </label>

          <label className="form-control w-full">
            <span className="label-text font-semibold text-sm">Exception / problem (optional)</span>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={3}
              value={exception}
              onChange={(e) => setException(e.target.value)}
              placeholder="Example: Provider delayed records; follow-up scheduled for Monday."
            />
            <span className="label-text-alt opacity-60">
              Use this for delays, missing info, or issues that need attorney attention.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm mt-0.5"
              checked={outOfScope}
              onChange={(e) => setOutOfScope(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-semibold">Additional work not in original assignment</span>
              <span className="block opacity-70 mt-0.5">
                Flag ad hoc work for attorney awareness. Related billable time still needs attorney
                approval before billing.
              </span>
            </span>
          </label>

          {outOfScope && (
            <label className="form-control w-full">
              <span className="label-text font-semibold text-sm">
                Why outside the assignment? <span className="text-error">*</span>
              </span>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={2}
                value={oosReason}
                onChange={(e) => setOosReason(e.target.value)}
                placeholder="Example: Client requested an extra records pull not on the checklist."
                required
              />
            </label>
          )}

          {error && (
            <div className="alert alert-error text-sm py-2">
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action mt-2">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Complete task
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" aria-label="Close" onClick={onCancel}>
          close
        </button>
      </form>
    </dialog>
  );
}
