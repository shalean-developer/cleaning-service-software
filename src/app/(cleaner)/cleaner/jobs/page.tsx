import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCleanerJobs } from "@/features/dashboards/server/cleanerJobReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CleanerJobListCard } from "@/components/dashboard/cleaner/CleanerJobListCard";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";

export const metadata: Metadata = {
  title: "Jobs | Cleaner",
};

export default async function CleanerJobsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await listCleanerJobs(user);

  return (
    <DashboardShell
      title="My jobs"
      subtitle="When, where, and pay for each assigned clean."
      nav={[...CLEANER_NAV_ITEMS]}
    >
      {!result.ok ? (
        <DashboardFetchError
          title="Could not load jobs"
          description={result.message}
        />
      ) : result.jobs.length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="When you accept an offer, the job will appear here with your schedule and pay."
          action={
            <Link
              href="/cleaner/offers"
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              View offers
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {result.jobs.map((j) => (
            <li key={j.bookingId}>
              <CleanerJobListCard
                href={`/cleaner/jobs/${j.bookingId}`}
                serviceLabel={j.serviceLabel}
                scheduleLabel={j.scheduleLabel}
                locationSummary={j.locationSummary}
                earningsLabel={j.earningsLabel}
                status={j.status}
              />
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
