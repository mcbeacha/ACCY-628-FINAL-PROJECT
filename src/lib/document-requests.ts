/**
 * Academic document-request workflow (attorney → paralegal → client).
 * Stored in browser localStorage so Demo Mode role switching can share the same queue.
 * Fictional data only — not a production document management system.
 */

export const DOCUMENT_REQUESTS_STORAGE_KEY = "rebel-law-document-requests";
export const DOCUMENT_REQUESTS_EVENT = "rebel-doc-requests-changed";

export type DocumentRequestStatus =
  | "pending_paralegal"
  | "paralegal_preparing"
  | "awaiting_client"
  | "client_submitted"
  | "ready_for_attorney"
  | "closed";

export type DocumentRequestPriority = "Low" | "Normal" | "High" | "Urgent";

export type DocumentAttachmentMeta = {
  fileName: string;
  fileSize: number;
  fileType: string;
  /** Small academic demo payloads only; omitted for larger files. */
  dataUrl?: string;
};

export type DocumentRequest = {
  id: string;
  matterId: string;
  matterNumber: string;
  matterName: string;
  clientId: string;
  clientName: string;
  attorneyId: string;
  attorneyName: string;
  paralegalId: string;
  paralegalName: string;
  /** What the attorney wants from the client. */
  attorneyInstructions: string;
  /** Paralegal-facing / client-facing refined request text. */
  clientInstructions: string;
  priority: DocumentRequestPriority;
  status: DocumentRequestStatus;
  /** Client submission deadline (YYYY-MM-DD), set by paralegal. */
  clientDueDate: string | null;
  clientResponseText: string;
  attachments: DocumentAttachmentMeta[];
  paralegalNotes: string;
  createdAt: string;
  updatedAt: string;
  sentToClientAt: string | null;
  clientSubmittedAt: string | null;
};

export const DOCUMENT_REQUEST_STATUS_LABELS: Record<DocumentRequestStatus, string> = {
  pending_paralegal: "Pending paralegal",
  paralegal_preparing: "Paralegal preparing",
  awaiting_client: "Awaiting client",
  client_submitted: "Client submitted",
  ready_for_attorney: "Ready for attorney",
  closed: "Closed",
};

const OPEN_STATUSES: DocumentRequestStatus[] = [
  "pending_paralegal",
  "paralegal_preparing",
  "awaiting_client",
  "client_submitted",
  "ready_for_attorney",
];

export function isOpenDocumentRequest(status: DocumentRequestStatus) {
  return OPEN_STATUSES.includes(status);
}

/** Days until due (negative = overdue). Null if no due date. */
export function daysUntilDue(dueDate: string | null | undefined): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Visual tone for cards/badges based on workflow status and due date.
 * - overdue: red
 * - due soon (≤7 days): amber
 * - awaiting client / on track: teal
 * - submitted / ready: green
 * - pending staff: blue
 * - closed: muted
 */
export function documentRequestTone(req: Pick<DocumentRequest, "status" | "clientDueDate">): {
  border: string;
  bg: string;
  badge: string;
  label: string;
} {
  if (req.status === "closed") {
    return {
      border: "border-base-300",
      bg: "bg-base-200/60",
      badge: "badge-ghost",
      label: "Closed",
    };
  }
  if (req.status === "client_submitted" || req.status === "ready_for_attorney") {
    return {
      border: "border-success",
      bg: "bg-success/10",
      badge: "badge-success",
      label: DOCUMENT_REQUEST_STATUS_LABELS[req.status],
    };
  }
  if (req.status === "pending_paralegal" || req.status === "paralegal_preparing") {
    return {
      border: "border-info",
      bg: "bg-info/10",
      badge: "badge-info",
      label: DOCUMENT_REQUEST_STATUS_LABELS[req.status],
    };
  }

  // awaiting_client — color by due date
  const days = daysUntilDue(req.clientDueDate);
  if (days != null && days < 0) {
    return {
      border: "border-error",
      bg: "bg-error/10",
      badge: "badge-error",
      label: "Overdue",
    };
  }
  if (days != null && days <= 7) {
    return {
      border: "border-warning",
      bg: "bg-warning/10",
      badge: "badge-warning",
      label: days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`,
    };
  }
  return {
    border: "border-accent",
    bg: "bg-accent/10",
    badge: "badge-accent",
    label: "Awaiting client",
  };
}

function notify() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DOCUMENT_REQUESTS_EVENT));
}

export function readDocumentRequests(): DocumentRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DOCUMENT_REQUESTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DocumentRequest[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeDocumentRequests(list: DocumentRequest[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DOCUMENT_REQUESTS_STORAGE_KEY, JSON.stringify(list));
  notify();
}

export function upsertDocumentRequest(next: DocumentRequest) {
  const list = readDocumentRequests();
  const idx = list.findIndex((r) => r.id === next.id);
  if (idx >= 0) list[idx] = next;
  else list.unshift(next);
  writeDocumentRequests(list);
  return next;
}

export function createDocumentRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `docreq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

/** Max bytes to embed as data URL in localStorage (academic demo). */
export const MAX_EMBEDDED_FILE_BYTES = 400_000;

export function readFileAsAttachment(file: File): Promise<DocumentAttachmentMeta> {
  return new Promise((resolve, reject) => {
    const meta: DocumentAttachmentMeta = {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || "application/octet-stream",
    };
    if (file.size > MAX_EMBEDDED_FILE_BYTES) {
      resolve(meta);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      resolve({ ...meta, dataUrl: String(reader.result || "") });
    };
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}
