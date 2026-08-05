import type { DirectoryPerson } from "@/lib/workspace-mock";
import { Mail, MapPin, Phone } from "lucide-react";

const AVAILABILITY_CLASS: Record<DirectoryPerson["availability"], string> = {
  Available: "badge-success",
  "In Court": "badge-warning",
  "In a Meeting": "badge-warning",
  "Out of Office": "badge-ghost",
};

export function ProfileCard({ person }: { person: DirectoryPerson }) {
  return (
    <div className="card bg-base-100 border border-base-300 shadow-sm transition-shadow hover:shadow-md">
      <div className="card-body p-5 gap-3">
        <div className="flex items-center gap-3">
          <div className="avatar avatar-placeholder">
            <div className="bg-primary/10 text-primary w-12 rounded-full">
              <span className="text-sm font-semibold">{person.initials}</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight truncate">
              {person.name}
            </p>
            <p className="text-sm opacity-70 truncate">{person.title}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="badge badge-ghost badge-sm">{person.department}</span>
          <span className={`badge badge-sm ${AVAILABILITY_CLASS[person.availability]}`}>
            {person.availability}
          </span>
        </div>

        <dl className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 opacity-60 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Office</dt>
            <dd className="truncate">
              {person.office} · {person.practiceArea}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 opacity-60 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Email</dt>
            <dd className="truncate">
              <a href={`mailto:${person.email}`} className="link link-hover">
                {person.email}
              </a>
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 opacity-60 shrink-0" aria-hidden="true" />
            <dt className="sr-only">Phone</dt>
            <dd>{person.phone}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
