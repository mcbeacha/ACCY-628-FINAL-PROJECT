import { EmptyState } from "@/components/EmptyState";
import {
  relativeTime,
  type ActivityEvent,
  type ActivityKind,
} from "@/lib/workspace-mock";
import {
  ArrowRightLeft,
  CalendarPlus,
  CheckCircle2,
  Clock,
  FileEdit,
  MessageSquare,
  StickyNote,
  Upload,
} from "lucide-react";

const ICONS: Record<ActivityKind, React.ComponentType<{ className?: string }>> = {
  document_uploaded: Upload,
  document_edited: FileEdit,
  task_completed: CheckCircle2,
  status_changed: ArrowRightLeft,
  time_logged: Clock,
  message_received: MessageSquare,
  note_added: StickyNote,
  deadline_created: CalendarPlus,
};

export function ActivityItem({ event }: { event: ActivityEvent }) {
  const Icon = ICONS[event.kind];
  return (
    <li className="flex gap-3 py-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-base-200 text-base-content/70">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium">{event.actor}</span> {event.description}
        </p>
        <p className="text-xs opacity-60 mt-0.5">
          {event.matterRef} · {relativeTime(event.minutesAgo)}
        </p>
      </div>
    </li>
  );
}

export function ActivityFeed({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="No recent activity"
        description="Updates to your matters will appear here as your team works."
      />
    );
  }
  return (
    <ul className="divide-y divide-base-200">
      {events.map((event) => (
        <ActivityItem key={event.id} event={event} />
      ))}
    </ul>
  );
}
