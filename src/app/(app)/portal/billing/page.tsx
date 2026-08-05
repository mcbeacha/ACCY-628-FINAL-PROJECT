import { redirect } from "next/navigation";

/** Legacy billing portal — Current Client invoices live under /client-portal. */
export default function LegacyPortalBillingRedirect() {
  redirect("/client-portal/invoices");
}
