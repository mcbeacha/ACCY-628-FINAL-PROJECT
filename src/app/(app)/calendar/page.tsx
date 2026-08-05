import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { CalendarClient } from "./CalendarClient";
import { attorneyCalendarEvents, CALENDAR_EVENTS } from "@/lib/workspace-mock";
import { redirect } from "next/navigation";

export default async function CalendarPage() {
  const { profile } = await requireUser();
  if (profile.role === "client") redirect("/dashboard");

  const events =
    profile.role === "attorney" ? attorneyCalendarEvents() : CALENDAR_EVENTS;

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Hearings, depositions, client meetings, filing deadlines, and firm events."
      />
      <CalendarClient events={events} />
    </>
  );
}
