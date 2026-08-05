import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { RESOURCES, type ResourceLink } from "@/lib/workspace-mock";
import {
  BookMarked,
  BookOpen,
  ClipboardList,
  FileStack,
  FileText,
  GraduationCap,
  Megaphone,
  Monitor,
  PenLine,
  Scale,
  type LucideIcon as LucideComponent,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

const CATEGORY_ICONS: Record<string, LucideComponent> = {
  "Firm Policies": FileText,
  "Court Rules": Scale,
  "Court Forms": ClipboardList,
  "Legal Templates": FileStack,
  "Brief Bank": BookMarked,
  "Contract Clauses": PenLine,
  "CLE Materials": GraduationCap,
  "Technology Guides": Monitor,
  "Marketing Resources": Megaphone,
};

function groupByCategory(resources: ResourceLink[]): { category: string; items: ResourceLink[] }[] {
  const order: string[] = [];
  const groups = new Map<string, ResourceLink[]>();

  for (const item of resources) {
    if (!groups.has(item.category)) {
      groups.set(item.category, []);
      order.push(item.category);
    }
    groups.get(item.category)!.push(item);
  }

  return order.map((category) => ({
    category,
    items: groups.get(category)!,
  }));
}

export default async function ResourcesPage() {
  const { profile } = await requireUser();

  if (profile.role === "client") {
    redirect("/dashboard");
  }

  const grouped = groupByCategory(RESOURCES);

  return (
    <>
      <PageHeader
        title="Resources"
        description="Firm policies, court materials, templates, and technology guides."
      />

      <div className="space-y-8">
        {grouped.map(({ category, items }) => {
          const Icon = CATEGORY_ICONS[category] ?? BookOpen;
          return (
            <section key={category} className="space-y-4">
              <h2 className="font-display text-xl font-semibold flex items-center gap-2">
                <Icon className="h-5 w-5 opacity-70" aria-hidden="true" />
                {category}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="card bg-base-100 border border-base-300 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="card-body p-5 gap-3">
                      <h3 className="font-display text-lg font-semibold leading-tight">{item.title}</h3>
                      <p className="text-sm opacity-70 flex-1">{item.description}</p>
                      <div>
                        <Link href={item.href} className="btn btn-outline btn-sm">
                          Open
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
