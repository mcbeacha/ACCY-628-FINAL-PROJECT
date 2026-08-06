/**
 * Display helpers so matter workflow badges stay consistent when
 * operational status and approval_status briefly diverge (e.g. after
 * financial seed updates or partial approval patches).
 */

type MatterStatusFields = {
  matter_status: string;
  approval_status: string;
};

/** Prefer Active when engagement is already Approved but matter_status lagged. */
export function displayMatterStatus(matter: MatterStatusFields): string {
  if (
    matter.approval_status === "Approved" &&
    matter.matter_status === "Pending Approval"
  ) {
    return "Active";
  }
  return matter.matter_status;
}

/** Prefer Approved when the matter is already Active/Closed but approval lagged. */
export function displayApprovalStatus(matter: MatterStatusFields): string {
  if (
    matter.approval_status === "Pending Approval" &&
    ["Active", "Closing", "Closed"].includes(matter.matter_status)
  ) {
    return "Approved";
  }
  return matter.approval_status;
}
