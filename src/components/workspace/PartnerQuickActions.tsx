"use client";

import {
  ClipboardCheck,
  Clock,
  FilePlus2,
  FileText,
  Inbox,
  Landmark,
  Megaphone,
  Receipt,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";

const PARTNER_ACTIONS = [
  { label: "Approval Inbox", Icon: Inbox, href: "/inbox", primary: true },
  { label: "Review Time", Icon: Clock, href: "/time/review" },
  { label: "Review Expenses", Icon: Receipt, href: "/expenses/review" },
  { label: "Review Costs", Icon: ClipboardCheck, href: "/costs/review" },
  { label: "Marketing ROI", Icon: Megaphone, href: "/marketing" },
  { label: "New Matter", Icon: FilePlus2, href: "/matters/new" },
  { label: "Invoices", Icon: FileText, href: "/invoices" },
  { label: "AR & Collections", Icon: Landmark, href: "/ar" },
  { label: "Controls", Icon: ShieldAlert, href: "/controls" },
] as const;

export function PartnerQuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {PARTNER_ACTIONS.map(({ label, Icon, href, ...rest }) => {
        const primary = "primary" in rest && rest.primary;
        return (
          <Link
            key={label}
            href={href}
            className={[
              "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              primary
                ? "bg-primary text-primary-content shadow-sm hover:brightness-110"
                : "border border-base-content/10 bg-base-100 text-base-content/80 shadow-[0_1px_2px_oklch(22%_0.03_255_/_0.04)] hover:border-primary/30 hover:text-primary",
            ].join(" ")}
          >
            <Icon className={`h-4 w-4 shrink-0 ${primary ? "opacity-90" : "opacity-55"}`} />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
