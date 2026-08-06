import { EmptyState } from "@/components/EmptyState";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import {
  priorityRank,
  type FocusItem,
  type FocusKind,
} from "@/lib/workspace-mock";
import {
  CalendarCheck,
  FileText,
  Gavel,
  ListChecks,
  MessageCircle,
  Timer,
} from "lucide-react";
import Link from "next/link";

const KIND_META: Record<FocusKind, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  task: { label: "Task", Icon: ListChecks },
  deadline: { label: "Deadline", Icon: Timer },
  court: { label: "Court", Icon: Gavel },
  meeting: { label: "Meeting", Icon: CalendarCheck },
  document: { label: "Document", Icon: FileText },
  client: { label: "Client", Icon: MessageCircle },
};

export function TodaysFocus({ items }: { items: FocusItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing due today"
        action={
          <Link href="/calendar" className="btn btn-primary btn-sm">
            Calendar
          </Link>
        }
      />
    );
  }

  const sorted = [...items].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));

  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {sorted.map((item) => {
        const { label, Icon } = KIND_META[item.kind];
        return (
          <li key={item.id}>
            <Link
              href={item.href}
              className="card bg-base-100 border border-base-300 shadow-sm transition-shadow hover:shadow-md hover:border-primary/50 block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="card-body p-4 gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide opacity-60">
                    {label}
                  </span>
                  {item.dueTime && (
                    <span className="ml-auto text-xs font-medium opacity-70">{item.dueTime}</span>
                  )}
                </div>

                <p className="font-medium leading-snug">{item.title}</p>
                <p className="text-xs opacity-70 truncate">
                  {item.matterRef} · {item.clientName}
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={item.priority} />
                  <StatusBadge status={item.status} />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
