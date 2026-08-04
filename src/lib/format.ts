import type { Client } from "./types";

export function clientDisplayName(client: Partial<Client> | null | undefined) {
  if (!client) return "Unknown client";
  if (client.client_type === "Individual") {
    return [client.first_name, client.last_name].filter(Boolean).join(" ") || "Unnamed client";
  }
  return client.organization_name || client.primary_contact_name || "Unnamed organization";
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
