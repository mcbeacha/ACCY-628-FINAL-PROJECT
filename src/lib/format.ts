import type { Client } from "./types";

export function clientDisplayName(client: Partial<Client> | null | undefined) {
  if (!client) return "Unknown client";

  const personName = [client.first_name, client.last_name].filter(Boolean).join(" ");
  const orgName = (client.organization_name || "").trim();
  const contactName = (client.primary_contact_name || "").trim();

  // Prefer person name for individuals. Also treat missing client_type as individual when
  // person fields are present and organization is empty (common when selects omit client_type).
  const isIndividual =
    client.client_type === "Individual" ||
    ((!client.client_type || client.client_type === "Other") && !!personName && !orgName);

  if (isIndividual) {
    return personName || contactName || "Unnamed client";
  }

  return orgName || contactName || personName || "Unnamed organization";
}

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isOverdue(dueDate: string | null | undefined, status: string) {
  if (!dueDate) return false;
  if (status === "Completed" || status === "Canceled") return false;
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function emailLooksValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
