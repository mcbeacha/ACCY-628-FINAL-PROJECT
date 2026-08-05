import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { CalendarClient } from "./CalendarClient";
import { redirect } from "next/navigation";

export default async function CalendarPage() {
  const { profile } = await requireUser();
  if (profile.role === "client") redirect("/client-portal");

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Hearings, depositions, client meetings, filing deadlines, and firm events."
      />
      <CalendarClient />
    </>
  );
}
