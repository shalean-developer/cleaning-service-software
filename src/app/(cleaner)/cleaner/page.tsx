import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  listCleanerJobs,
  listCleanerOffersForDashboard,
} from "@/features/dashboards/server/cleanerJobReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  labelForBookingStatus,
  labelForOfferStatus,
  toneForBookingStatus,
  toneForOfferStatus,
} from "@/features/bookings/server/statusLabels";

export const metadata: Metadata = {
  title: "Cleaner | Cleaning Services",
};

export default async function CleanerHomePage() {
  const user = await getCurrentUser();
  const offers = user ? await listCleanerOffersForDashboard(user) : null;
  const jobs = user ? await listCleanerJobs(user) : null;

  const openOffers =
    offers?.ok ? offers.offers.filter((o) => o.status === "offered" && !o.isExpired) : [];
  const activeJobs = jobs?.ok ? jobs.jobs.filter((j) => j.status !== "completed") : [];

  return (
    <DashboardShell
      title="Cleaner dashboard"
      subtitle="Review offers and manage assigned jobs."
      nav={[
        { href: "/cleaner", label: "Home" },
        { href: "/cleaner/offers", label: "Offers" },
        { href: "/cleaner/jobs", label: "Jobs" },
        { href: "/cleaner/earnings", label: "Earnings" },
      ]}
    >
      <section className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Open offers</h2>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{openOffers.length}</p>
          <Link href="/cleaner/offers" className="mt-3 inline-block text-sm text-zinc-600 hover:text-zinc-900">
            View offers →
          </Link>
        </section>
        <section className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-900">Active jobs</h2>
          <p className="mt-1 text-2xl font-semibold text-zinc-900">{activeJobs.length}</p>
          <Link href="/cleaner/jobs" className="mt-3 inline-block text-sm text-zinc-600 hover:text-zinc-900">
            View jobs →
          </Link>
        </section>
      </section>

      {openOffers.length > 0 ? (
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

      {activeJobs.length > 0 ? (
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
                    label={labelForBookingStatus(j.status)}
                    tone={toneForBookingStatus(j.status)}
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
