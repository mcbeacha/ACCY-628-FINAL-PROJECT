"use client";

import {
  ClipboardCheck,
  Clock,
  FilePlus2,
  FileText,
  Inbox,
  Landmark,
  Receipt,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

const PARTNER_ACTIONS = [
  { label: "Approval Inbox", Icon: Inbox, href: "/inbox" },
  { label: "Review Time", Icon: Clock, href: "/time/review" },
  { label: "Review Expenses", Icon: Receipt, href: "/expenses/review" },
  { label: "Review Costs", Icon: ClipboardCheck, href: "/costs/review" },
  { label: "New Matter", Icon: FilePlus2, href: "/matters/new" },
  { label: "Invoices", Icon: FileText, href: "/invoices" },
  { label: "AR & Collections", Icon: Landmark, href: "/ar" },
  { label: "Controls", Icon: ShieldAlert, href: "/controls" },
] as const;

export function PartnerQuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PARTNER_ACTIONS.map(({ label, Icon, href }) => (
        <Link
          key={label}
          href={href}
          className="btn btn-outline btn-sm h-auto justify-start gap-2 py-2.5 normal-case"
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </div>
  );
}
