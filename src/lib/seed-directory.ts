/**
 * Seeded demo profile directory used when RLS blocks profile embeds
 * (e.g. client portal cannot SELECT other profiles directly).
 * Keep in sync with demo Auth / profiles seed UUIDs.
 */
export const SEED_PROFILE_DIRECTORY: Record<
  string,
  { full_name: string; email: string | null; job_title: string | null; role: string }
> = {
  "a1000000-0000-4000-8000-000000000001": {
    full_name: "Margaret Sinclair",
    email: "partner@rebellaw.demo",
    job_title: "Managing Partner",
    role: "managing_partner",
  },
  "a1000000-0000-4000-8000-000000000002": {
    full_name: "Jordan Harper",
    email: "jharper@rebellaw.demo",
    job_title: "Senior Associate",
    role: "attorney",
  },
  "a1000000-0000-4000-8000-000000000003": {
    full_name: "Avery Chen",
    email: "achen@rebellaw.demo",
    job_title: "Associate Attorney",
    role: "attorney",
  },
  "a1000000-0000-4000-8000-000000000004": {
    full_name: "Priya Rose",
    email: "prose@rebellaw.demo",
    job_title: "Paralegal",
    role: "paralegal",
  },
  "a1000000-0000-4000-8000-000000000005": {
    full_name: "Sam Okonkwo",
    email: "billing@rebellaw.demo",
    job_title: "Billing Coordinator",
    role: "billing_staff",
  },
};

export function seedProfileContact(id: string | null | undefined) {
  if (!id) return null;
  return SEED_PROFILE_DIRECTORY[id] || null;
}
