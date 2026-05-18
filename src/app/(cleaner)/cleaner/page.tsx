import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  listCleanerJobs,
  listCleanerOffersForDashboard,
} from "@/features/dashboards/server/cleanerJobReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { CleanerJobListCard } from "@/components/dashboard/cleaner/CleanerJobListCard";
import { CleanerOfferListCard } from "@/components/dashboard/cleaner/CleanerOfferListCard";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";
import { CLEANER_DETAIL_CARD_CLASS } from "@/features/dashboards/cleanerJobDetailDisplay";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";

export const metadata: Metadata = {
  title: "Cleaner | Cleaning Services",
};

export default async function CleanerHomePage() {
  const user = await getCurrentUser();
  const offers = user ? await listCleanerOffersForDashboard(user) : null;
  const jobs = user ? await listCleanerJobs(user) : null;

  const offersOk = offers?.ok === true;
  const jobsOk = jobs?.ok === true;
  const openOffers = offersOk
    ? offers.offers.filter((o) => o.status === "offered" && !o.isExpired)
    : [];
  const activeJobs = jobsOk
    ? jobs.jobs.filter((j) => j.status !== "completed")
    : [];

  return (
    <DashboardShell
      title="Cleaner home"
      subtitle="Offers waiting for you and jobs on your schedule."
      nav={[...CLEANER_NAV_ITEMS]}
    >
      <section className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <section className={`${CLEANER_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
          <h2 className="text-sm font-medium text-zinc-800">Open offers</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
            {offersOk ? openOffers.length : "—"}
          </p>
          <Link
            href="/cleaner/offers"
            className="mt-3 inline-block text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
          >
            View all offers
          </Link>
        </section>
        <section className={`${CLEANER_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
          <h2 className="text-sm font-medium text-zinc-800">Active jobs</h2>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
            {jobsOk ? activeJobs.length : "—"}
          </p>
          <Link
            href="/cleaner/jobs"
            className="mt-3 inline-block text-sm font-medium text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
          >
            View all jobs
          </Link>
        </section>
      </section>

      {offers && !offers.ok ? (
        <section className="mt-6">
          <DashboardFetchError
            title={dashboardFetchErrorTitle("offers", "cleaner")}
            description={offers.message}
          />
        </section>
      ) : openOffers.length > 0 ? (
        <section className="mt-6 sm:mt-8">
          <h2 className="text-sm font-medium text-zinc-800">Needs your response</h2>
          <ul className="mt-3 space-y-3">
            {openOffers.slice(0, 3).map((o) => (
              <li key={o.offerId}>
                <CleanerOfferListCard
                  href="/cleaner/offers"
                  serviceLabel={o.serviceLabel}
                  scheduleLabel={o.scheduleLabel}
                  locationSummary={o.locationSummary}
                  earningsLabel={o.earningsLabel}
                  status={o.status}
                  isExpired={o.isExpired}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {jobs && !jobs.ok ? (
        <section className="mt-6">
          <DashboardFetchError
            title={dashboardFetchErrorTitle("jobs", "cleaner")}
            description={jobs.message}
          />
        </section>
      ) : activeJobs.length > 0 ? (
        <section className="mt-6 sm:mt-8">
          <h2 className="text-sm font-medium text-zinc-800">Upcoming jobs</h2>
          <ul className="mt-3 space-y-3">
            {activeJobs.slice(0, 3).map((j) => (
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
        </section>
      ) : null}
    </DashboardShell>
  );
}
