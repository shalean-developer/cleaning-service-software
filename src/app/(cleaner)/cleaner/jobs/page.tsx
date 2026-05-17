import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCleanerJobs } from "@/features/dashboards/server/cleanerJobReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";
import {
  labelForCleanerJobStatus,
  toneForCleanerJobStatus,
} from "@/features/bookings/server/statusLabels";

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
      subtitle="Assigned cleans you are scheduled to perform."
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
          description="Accepted jobs and active work will appear here."
          action={
            <Link
              href="/cleaner/offers"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              View offers
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {result.jobs.map((j) => (
            <li key={j.bookingId}>
              <Link
                href={`/cleaner/jobs/${j.bookingId}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300"
              >
                <StatusBadge
                  label={labelForCleanerJobStatus(j.status)}
                  tone={toneForCleanerJobStatus(j.status)}
                />
                <p className="mt-2 font-medium text-zinc-900">{j.serviceLabel}</p>
                <p className="text-sm text-zinc-600">{j.scheduleLabel}</p>
                <p className="text-sm text-zinc-500">{j.locationSummary}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
