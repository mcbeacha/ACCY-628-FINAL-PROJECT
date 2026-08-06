import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { CalendarClient } from "./CalendarClient";
import { calendarConfigForRole } from "@/lib/calendar";

export default async function CalendarPage() {
  const { profile } = await requireUser();
  const config = calendarConfigForRole(profile.role);

  return (
    <>
      <PageHeader title={config.title} description={config.description} />
      <CalendarClient role={profile.role} />
    </>
  );
}
