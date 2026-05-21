import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CustomerDashboardHeaderEndLoader } from "@/components/dashboard/customer/CustomerDashboardHeaderEndLoader";
import { CUSTOMER_DASHBOARD_NAV } from "@/features/dashboards/customerNav";
import { listCustomerRecurringSeries } from "@/features/recurring/server/customerRecurringSeriesReadModel";
import { CustomerRecurringSeriesCard } from "@/components/dashboard/customer/CustomerRecurringSeriesCard";
import { CustomerRecurringScheduleGroupCard } from "@/components/dashboard/customer/CustomerRecurringScheduleGroupCard";
import { EmptyState } from "@/components/dashboard/EmptyState";

export const metadata: Metadata = {
  title: "Recurring cleans | Customer",
};

export default async function CustomerRecurringListPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await listCustomerRecurringSeries(user);

  return (
    <DashboardShell
      title="Recurring cleans"
      subtitle="Recurring visits — pay each visit to confirm before we assign your cleaner"
      nav={[...CUSTOMER_DASHBOARD_NAV]}
      headerEnd={<CustomerDashboardHeaderEndLoader />}
    >
      <Link
        href="/customer/bookings"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
      >
        ← All bookings
      </Link>

      {!result.ok ? (
        <p className="mt-4 text-sm text-red-800">{result.message}</p>
      ) : result.groups.length === 0 && result.standaloneSeries.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={
              result.emptyReason === "none_for_account"
                ? "No recurring series for this account"
                : "No recurring series yet"
            }
            description={
              result.emptyReason === "none_for_account"
                ? "This signed-in account does not own any recurring schedules. If you booked under another email, sign in with that account."
                : "When you pay for a weekly, bi-weekly, or monthly first visit, your schedule appears here."
            }
            action={
              <Link
                href="/customer/book"
                className="text-sm font-medium text-zinc-900 underline"
              >
                Book a clean
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {result.groups.map((group) => (
            <CustomerRecurringScheduleGroupCard key={group.groupId} item={group} />
          ))}
          {result.standaloneSeries.map((item) => (
            <CustomerRecurringSeriesCard key={item.seriesId} item={item} />
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
