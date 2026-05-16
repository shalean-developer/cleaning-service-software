import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCleanerOffersForDashboard } from "@/features/dashboards/server/cleanerJobReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { OfferActions } from "@/components/dashboard/OfferActions";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  labelForOfferStatus,
  toneForOfferStatus,
} from "@/features/bookings/server/statusLabels";

export const metadata: Metadata = {
  title: "Offers | Cleaner",
};

export default async function CleanerOffersPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await listCleanerOffersForDashboard(user);
  const offers = result.ok ? result.offers : [];

  return (
    <DashboardShell
      title="Assignment offers"
      subtitle="Accept or decline jobs offered to you."
      nav={[
        { href: "/cleaner", label: "Home" },
        { href: "/cleaner/offers", label: "Offers" },
        { href: "/cleaner/jobs", label: "Jobs" },
      ]}
    >
      {offers.length === 0 ? (
        <EmptyState
          title="No offers"
          description="When dispatch sends you a job, it will appear here."
        />
      ) : (
        <ul className="space-y-4">
          {offers.map((o) => {
            const canRespond = o.status === "offered" && !o.isExpired;
            return (
              <li
                key={o.offerId}
                className="rounded-xl border border-zinc-200 bg-white p-5"
              >
                <section className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={
                      o.isExpired && o.status === "offered"
                        ? "Expired"
                        : labelForOfferStatus(o.status)
                    }
                    tone={
                      o.isExpired && o.status === "offered"
                        ? "danger"
                        : toneForOfferStatus(o.status)
                    }
                  />
                </section>
                <p className="mt-3 font-medium text-zinc-900">{o.serviceLabel}</p>
                <p className="text-sm text-zinc-600">{o.scheduleLabel}</p>
                <p className="text-sm text-zinc-500">{o.locationSummary}</p>
                <p className="mt-1 text-sm font-medium text-zinc-800">
                  <span className="text-zinc-500">Your earnings · </span>
                  {o.earningsLabel}
                </p>
                {o.expiresAt ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Expires {new Date(o.expiresAt).toLocaleString("en-ZA")}
                  </p>
                ) : null}
                {canRespond ? (
                  <section className="mt-4">
                    <OfferActions offerId={o.offerId} />
                  </section>
                ) : o.status === "accepted" ? (
                  <Link
                    href={`/cleaner/jobs/${o.bookingId}`}
                    className="mt-4 inline-block text-sm font-medium text-zinc-700 hover:text-zinc-900"
                  >
                    View job →
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
