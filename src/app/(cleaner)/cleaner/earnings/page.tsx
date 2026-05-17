import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCleanerEarnings } from "@/features/earnings/server/payoutReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import {
  labelForPayoutStatus,
  toneForPayoutStatus,
} from "@/features/bookings/server/statusLabels";

export const metadata: Metadata = {
  title: "Earnings | Cleaner",
};

export default async function CleanerEarningsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await listCleanerEarnings(user);

  return (
    <DashboardShell
      title="Earnings"
      subtitle="Payout amounts from completed jobs."
      nav={[...CLEANER_NAV_ITEMS]}
    >
      {!result.ok ? (
        <DashboardFetchError
          title="Could not load earnings"
          description={result.message}
        />
      ) : result.earnings.length === 0 ? (
        <EmptyState
          title="No earnings yet"
          description="Complete assigned jobs to see earnings here."
          action={
            <Link
              href="/cleaner/jobs"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              View jobs
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {result.earnings.map((e) => (
            <li
              key={e.id}
              className="rounded-xl border border-zinc-200 bg-white p-4"
            >
              <StatusBadge
                label={labelForPayoutStatus(e.payoutStatus)}
                tone={toneForPayoutStatus(e.payoutStatus)}
              />
              <p className="mt-2 font-medium text-zinc-900">{e.serviceLabel}</p>
              <p className="text-sm text-zinc-600">{e.scheduleLabel}</p>
              <p className="mt-2 text-lg font-semibold text-zinc-900">
                {formatZar(e.payoutAmountCents)}
              </p>
              {e.bookingId ? (
                <Link
                  href={`/cleaner/jobs/${e.bookingId}`}
                  className="mt-2 inline-block text-sm text-zinc-600 hover:text-zinc-900"
                >
                  View job →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
