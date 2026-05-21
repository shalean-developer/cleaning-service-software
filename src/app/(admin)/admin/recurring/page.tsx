import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import {
  ADMIN_OVERVIEW_MUTED_CLASS,
  ADMIN_OVERVIEW_SECTION_LABEL_CLASS,
  ADMIN_OVERVIEW_SERIF_TITLE_CLASS,
} from "@/components/dashboard/admin/overview/adminOverviewStyles";
import { listAdminRecurringSeries } from "@/features/recurring/server/adminRecurringSeriesReadModel";
import { parseAdminRecurringListQuery } from "@/features/recurring/adminRecurringQuery";
import { AdminRecurringSummaryCards } from "@/components/dashboard/admin/recurring/AdminRecurringSummaryCards";
import { AdminRecurringToolbar } from "@/components/dashboard/admin/recurring/AdminRecurringToolbar";
import { AdminRecurringSeriesCard } from "@/components/dashboard/admin/recurring/AdminRecurringSeriesCard";
import { AdminRecurringScheduleGroupCard } from "@/components/dashboard/admin/recurring/AdminRecurringScheduleGroupCard";
import { EmptyState } from "@/components/dashboard/EmptyState";

export const metadata: Metadata = {
  title: "Recurring series | Admin",
};

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function AdminRecurringPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  const query = parseAdminRecurringListQuery(params);
  const result = await listAdminRecurringSeries(user, query);

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      <header className="mb-5 space-y-1.5">
        <p className={ADMIN_OVERVIEW_SECTION_LABEL_CLASS}>Operate</p>
        <h1 className={`${ADMIN_OVERVIEW_SERIF_TITLE_CLASS} text-3xl sm:text-4xl`}>
          Recurring series
        </h1>
        <p className={ADMIN_OVERVIEW_MUTED_CLASS}>
          Materialized weekly, bi-weekly, and monthly schedules after first payment.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/admin/recurring/health"
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Recurring health dashboard →
          </Link>
          {result.ok && result.summary.openSupportRequestsCount > 0 ? (
            <Link
              href="/admin/recurring?requests=open"
              className="text-sm font-semibold text-violet-800 hover:text-violet-950"
            >
              {result.summary.openSupportRequestsCount} open customer request
              {result.summary.openSupportRequestsCount === 1 ? "" : "s"} →
            </Link>
          ) : null}
        </div>
      </header>

      {!result.ok ? (
        <p className="text-sm text-red-800">{result.message}</p>
      ) : (
        <>
          <AdminRecurringSummaryCards summary={result.summary} />
          <div className="mt-6">
            <AdminRecurringToolbar query={query} />
          </div>
          <div className="mt-6 space-y-3">
            {result.groups.length === 0 && result.standaloneSeries.length === 0 ? (
              <EmptyState
                title="No recurring series"
                description="Series appear after a customer pays for a weekly, bi-weekly, or monthly first visit."
                action={
                  <Link
                    href="/admin/recurring"
                    className="text-sm font-medium text-blue-700 hover:text-blue-900"
                  >
                    Clear filters
                  </Link>
                }
              />
            ) : (
              <>
                {result.groups.map((group) => (
                  <AdminRecurringScheduleGroupCard key={group.groupId} item={group} />
                ))}
                {result.standaloneSeries.map((item) => (
                  <AdminRecurringSeriesCard key={item.seriesId} item={item} />
                ))}
              </>
            )}
          </div>
        </>
      )}
    </AdminDashboardShell>
  );
}
