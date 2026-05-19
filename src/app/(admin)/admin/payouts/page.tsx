import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAdminPayoutSummary } from "@/features/earnings/server/payoutReadModel";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import {
  ADMIN_DETAIL_CARD_CLASS,
  ADMIN_LIST_CARD_CLASS,
} from "@/features/dashboards/adminDisplay";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";

export const metadata: Metadata = {
  title: "Payouts | Admin",
};

export default async function AdminPayoutsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await getAdminPayoutSummary(user);

  return (
    <AdminDashboardShell
      title="Payouts"
      subtitle="Earnings ledger and payout readiness."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      {!result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("payouts", "admin")}
          description={result.message}
        />
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <section className={`${ADMIN_DETAIL_CARD_CLASS} p-3.5 sm:p-4`}>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Pending
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
                {formatZar(result.summary.pendingCents)}
              </p>
            </section>
            <section
              className={`${ADMIN_DETAIL_CARD_CLASS} border-amber-200/80 bg-amber-50/40 p-3.5 sm:p-4`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-amber-900/80">
                Payout-ready
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-amber-950">
                {formatZar(result.summary.payoutReadyCents)}
              </p>
            </section>
            <section
              className={`${ADMIN_DETAIL_CARD_CLASS} border-emerald-200/80 bg-emerald-50/40 p-3.5 sm:p-4`}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-900/80">
                Paid
              </p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-950">
                {formatZar(result.summary.paidCents)}
              </p>
            </section>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold text-zinc-900">Payout-ready queue</h2>
            {result.summary.queue.length === 0 ? (
              <section className="mt-3">
                <EmptyState
                  title="No bookings awaiting payout"
                  description="Completed jobs with earnings ready for payout appear here."
                />
              </section>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {result.summary.queue.map((item) => (
                  <li key={item.bookingId}>
                    <Link href={`/admin/bookings/${item.bookingId}`} className={ADMIN_LIST_CARD_CLASS}>
                      <p className="text-sm font-semibold text-zinc-900">{item.serviceLabel}</p>
                      <p className="mt-0.5 text-sm text-zinc-600">
                        {item.customerLabel} · {item.scheduleLabel}
                      </p>
                      <p className="mt-1 text-xs font-medium text-zinc-800">
                        Payout {formatZar(item.payoutAmountCents)} · {item.earningCount} line
                        {item.earningCount === 1 ? "" : "s"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p className="mt-6 text-xs text-zinc-500">
            Batch settlement and transfer history are placeholders until external payout
            automation is integrated.
          </p>
        </>
      )}
    </AdminDashboardShell>
  );
}
