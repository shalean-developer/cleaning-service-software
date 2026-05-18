import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  listCleanerJobs,
  listCleanerOffersForDashboard,
} from "@/features/dashboards/server/cleanerJobReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";
import {
  labelForCleanerJobStatus,
  labelForOfferStatus,
  toneForCleanerJobStatus,
  toneForOfferStatus,
} from "@/features/bookings/server/statusLabels";

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
      title="Cleaner dashboard"
      subtitle="Review offers and manage assigned jobs."
      nav={[...CLEANER_NAV_ITEMS]}
    >
      <section className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Open offers</h2>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {offersOk ? openOffers.length : "—"}
          </p>
          <Link href="/cleaner/offers" className="mt-3 inline-block text-sm text-zinc-600 hover:text-zinc-900">
            View offers →
          </Link>
        </section>
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Active jobs</h2>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">
            {jobsOk ? activeJobs.length : "—"}
          </p>
          <Link href="/cleaner/jobs" className="mt-3 inline-block text-sm text-zinc-600 hover:text-zinc-900">
            View jobs →
          </Link>
        </section>
      </section>

      {offers && !offers.ok ? (
        <section className="mt-8">
          <DashboardFetchError
            title="Could not load offers"
            description={offers.message}
          />
        </section>
      ) : openOffers.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900">Needs response</h2>
          <ul className="mt-3 space-y-3">
            {openOffers.slice(0, 3).map((o) => (
              <li key={o.offerId}>
                <Link
                  href="/cleaner/offers"
                  className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300"
                >
                  <StatusBadge
                    label={labelForOfferStatus(o.status)}
                    tone={toneForOfferStatus(o.status)}
                  />
                  <p className="mt-2 font-medium text-zinc-900">{o.serviceLabel}</p>
                  <p className="text-sm text-zinc-600">{o.scheduleLabel}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {jobs && !jobs.ok ? (
        <section className="mt-8">
          <DashboardFetchError
            title="Could not load jobs"
            description={jobs.message}
          />
        </section>
      ) : activeJobs.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-zinc-900">Upcoming jobs</h2>
          <ul className="mt-3 space-y-3">
            {activeJobs.slice(0, 3).map((j) => (
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
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </DashboardShell>
  );
}
