import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCleanerEarnings } from "@/features/earnings/server/payoutReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { CLEANER_NAV_ITEMS } from "@/features/dashboards/cleanerNav";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { CleanerEarningsListCard } from "@/components/dashboard/cleaner/CleanerEarningsListCard";
import {
  CLEANER_EARNINGS_EMPTY,
  CLEANER_EARNINGS_PAGE_TRUST_LINE,
} from "@/features/dashboards/cleanerEarningsPresentation";
import { UI_BUTTON_PRIMARY_CLASS, UI_BUTTON_SECONDARY_CLASS } from "@/lib/ui/productUiTokens";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";

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
      subtitle="Pay from completed jobs and payout status."
      nav={[...CLEANER_NAV_ITEMS]}
    >
      {!result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("earnings", "cleaner")}
          description={result.message}
        />
      ) : result.earnings.length === 0 ? (
        <EmptyState
          title={CLEANER_EARNINGS_EMPTY.title}
          description={CLEANER_EARNINGS_EMPTY.description}
          action={
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
              <Link href="/cleaner/jobs" className={UI_BUTTON_PRIMARY_CLASS}>
                View jobs
              </Link>
              <Link href="/cleaner/offers" className={UI_BUTTON_SECONDARY_CLASS}>
                Check offers
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <p className="mb-4 text-xs leading-snug text-zinc-600">{CLEANER_EARNINGS_PAGE_TRUST_LINE}</p>
          <ul className="space-y-3">
            {result.earnings.map((e) => (
              <li key={e.id}>
                <CleanerEarningsListCard
                  item={{
                    id: e.id,
                    serviceLabel: e.serviceLabel,
                    scheduleLabel: e.scheduleLabel,
                    payoutAmountCents: e.payoutAmountCents,
                    payoutStatus: e.payoutStatus,
                    bookingId: e.bookingId,
                  }}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardShell>
  );
}
