import {
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  Landmark,
  Receipt,
  Scale,
  Unlink,
  Wallet,
} from "lucide-react";
import Link from "next/link";

type QuickAction = {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const ACTIONS: QuickAction[] = [
  { label: "Prepare invoice", Icon: FileText, href: "/invoices/new" },
  { label: "Unbilled activity", Icon: Unlink, href: "/unbilled" },
  { label: "Payments", Icon: Wallet, href: "/payments" },
  { label: "AR aging", Icon: Scale, href: "/ar" },
  { label: "Retainers", Icon: Landmark, href: "/retainers" },
  { label: "Billing readiness", Icon: ClipboardCheck, href: "/billing-readiness" },
  { label: "Invoices", Icon: Receipt, href: "/invoices" },
  { label: "Tax exports", Icon: FileSpreadsheet, href: "/exports" },
];

export function BillingQuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {ACTIONS.map(({ label, Icon, href }) => (
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
