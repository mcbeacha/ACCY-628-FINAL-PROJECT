import { statusBadgeClass, priorityBadgeClass } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${statusBadgeClass(status)}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`badge badge-outline ${priorityBadgeClass(priority)}`}>
      {priority}
    </span>
  );
}
