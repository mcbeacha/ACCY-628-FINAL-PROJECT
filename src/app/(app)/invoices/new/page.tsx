import { requireUser } from "@/lib/auth";
import { canPrepareInvoices } from "@/lib/permissions";
import { PrepareInvoiceClient } from "./PrepareInvoiceClient";
import { redirect } from "next/navigation";

export default async function NewInvoicePage() {
  const { profile } = await requireUser();
  if (!canPrepareInvoices(profile.role)) redirect("/dashboard");
  return <PrepareInvoiceClient userId={profile.id} role={profile.role} />;
}
