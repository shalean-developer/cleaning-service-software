import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCleanerJobs } from "@/features/dashboards/server/cleanerJobReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CleanerDashboardHeaderEndLoader } from "@/components/dashboard/cleaner/CleanerDashboardHeaderEndLoader";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CleanerJobListCard } from "@/components/dashboard/cleaner/CleanerJobListCard";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";
import { CleanerDashboardOperationalIntro } from "@/components/dashboard/cleaner/CleanerDashboardOperationalIntro";
import { getCleanerDashboardOperationalContext } from "@/features/dashboards/server/cleanerOperationalContext";
import { cleanerOperationalEmptyJobsCopy } from "@/components/dashboard/cleaner/CleanerOnboardingBanner";

export const metadata: Metadata = {
  title: "Jobs | Cleaner",
};

export default async function CleanerJobsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const operational = await getCleanerDashboardOperationalContext(user);
  const result = await listCleanerJobs(user);
  const operationalState =
    operational.ok ? operational.context.operationalState : "active";
  const operationalEmpty = cleanerOperationalEmptyJobsCopy(operationalState);

  return (
    <DashboardShell
      title="My jobs"
      subtitle="Schedule, location, and pay per job."
      nav={[...CLEANER_NAV_ITEMS]}
      headerEnd={<CleanerDashboardHeaderEndLoader />}
    >
      <div className="mb-6">
        <CleanerDashboardOperationalIntro />
      </div>

      {!result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("jobs", "cleaner")}
          description={result.message}
        />
      ) : result.jobs.length === 0 ? (
        <EmptyState
          title={operationalEmpty?.title ?? "No jobs yet"}
          description={
            operationalEmpty?.description ??
            "Accepted offers appear here with your schedule and pay."
          }
          action={
            operationalState === "active" ? (
              <Link
                href="/cleaner/offers"
                className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                View offers
              </Link>
            ) : undefined
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
                teamRoleLabel={j.teamRoleLabel}
              />
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
