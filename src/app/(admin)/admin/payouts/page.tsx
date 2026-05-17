import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAdminPayoutSummary } from "@/features/earnings/server/payoutReadModel";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";

export const metadata: Metadata = {
  title: "Payouts | Admin",
};

export default async function AdminPayoutsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await getAdminPayoutSummary(user);

  return (
    <DashboardShell
      title="Payouts"
      subtitle="Earnings ledger and payout readiness (no bank transfers yet)."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      {!result.ok ? (
        <p className="text-sm text-red-600">{result.message}</p>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <section className="rounded-xl border border-zinc-200 bg-white p-4">
              <p className="text-xs text-zinc-500">Pending</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900">
                {formatZar(result.summary.pendingCents)}
              </p>
            </section>
            <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs text-amber-800">Payout-ready</p>
              <p className="mt-1 text-xl font-semibold text-amber-950">
                {formatZar(result.summary.payoutReadyCents)}
              </p>
            </section>
            <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs text-emerald-800">Paid</p>
              <p className="mt-1 text-xl font-semibold text-emerald-950">
                {formatZar(result.summary.paidCents)}
              </p>
            </section>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-zinc-900">Payout-ready queue</h2>
            {result.summary.queue.length === 0 ? (
              <section className="mt-4">
                <EmptyState
                  title="No bookings awaiting payout"
                  description="Completed bookings with earnings appear here."
                />
              </section>
            ) : (
              <ul className="mt-4 space-y-3">
                {result.summary.queue.map((item) => (
                  <li key={item.bookingId}>
                    <Link
                      href={`/admin/bookings/${item.bookingId}`}
                      className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300"
                    >
                      <p className="font-medium text-zinc-900">{item.serviceLabel}</p>
                      <p className="text-sm text-zinc-600">
                        {item.customerLabel} · {item.scheduleLabel}
                      </p>
                      <p className="mt-1 text-sm text-zinc-800">
                        Payout {formatZar(item.payoutAmountCents)} · {item.earningCount} line(s)
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-8 text-sm text-zinc-500">
            Payout history and batch settlement UI are placeholders until external transfer
            automation is integrated.
          </p>
        </>
      )}
    </DashboardShell>
  );
}
