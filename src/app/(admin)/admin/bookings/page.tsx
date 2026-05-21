import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listAdminBookings } from "@/features/dashboards/server/adminOperationsReadModel";
import { getAdminOperationalQueueCounts } from "@/features/dashboards/server/adminOperationalQueueCounts";
import { AdminBookingsOperationalGuide } from "@/components/dashboard/admin/AdminBookingsOperationalGuide";
import {
  buildAdminOperationalQueueContextCard,
  isAdminOperationalQueueFilter,
} from "@/features/dashboards/adminOperationalQueues";
import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";
import { AdminBookingsOperationsHeader } from "@/components/dashboard/admin/bookings/AdminBookingsOperationsHeader";
import { AdminBookingsOperationsToolbar } from "@/components/dashboard/admin/bookings/AdminBookingsOperationsToolbar";
import { AdminBookingsOperationsList } from "@/components/dashboard/admin/bookings/AdminBookingsOperationsList";
import { AdminBookingsOperationsExtras } from "@/components/dashboard/admin/bookings/AdminBookingsOperationsExtras";
import {
  filterAdminBookingsForView,
  resolveAdminBookingsViewChip,
} from "@/features/dashboards/adminBookingsViewPresets";

export const metadata: Metadata = {
  title: "Booking operations | Admin",
};

const VALID_FILTERS = new Set<AdminBookingFilter>([
  "payment_failed",
  "pending_assignment",
  "assignment_attention",
  "dispatch_not_started",
  "selected_declined",
  "max_attempts",
  "recovery_needed",
  "two_cleaner_request",
  "operational_load",
  "team_awaiting_coordination",
  "team_fully_coordinated",
  "high_operational_load",
  "team_high_risk_combo",
]);

type PageProps = {
  searchParams: Promise<{
    filter?: string;
    view?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
};

export default async function AdminBookingsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  const filterParam = params.filter;
  const filter =
    filterParam && VALID_FILTERS.has(filterParam as AdminBookingFilter)
      ? (filterParam as AdminBookingFilter)
      : undefined;

  const viewChip = resolveAdminBookingsViewChip({
    filter,
    view: params.view,
    from: params.from,
    to: params.to,
  });

  const [result, queueCounts] = await Promise.all([
    listAdminBookings(user, {
      filter,
      search: params.q,
      scheduledFrom: params.from,
      scheduledTo: params.to,
    }),
    getAdminOperationalQueueCounts(user),
  ]);

  const displayedBookings =
    result.ok ? filterAdminBookingsForView(result.bookings, viewChip) : [];

  const queueContextCard =
    queueCounts.ok && filter && isAdminOperationalQueueFilter(filter)
      ? buildAdminOperationalQueueContextCard(filter, queueCounts.queues)
      : null;

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      <AdminBookingsOperationsHeader shownCount={displayedBookings.length} />

      {result.ok ? (
        <AdminBookingsOperationsToolbar
          filter={filter}
          view={params.view}
          search={params.q}
          scheduledFrom={params.from}
          scheduledTo={params.to}
        />
      ) : null}

      {queueContextCard ? <AdminBookingsOperationalGuide card={queueContextCard} /> : null}

      {!result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "admin")}
          description={result.message}
        />
      ) : displayedBookings.length === 0 ? (
        <EmptyState
          title="No matching bookings"
          description={
            filter || params.q || params.view || params.from
              ? "Try clearing filters or widening your search."
              : "Bookings appear here as customers checkout."
          }
          action={
            filter || params.q || params.view || params.from ? (
              <Link
                href="/admin/bookings"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <AdminBookingsOperationsList bookings={displayedBookings} />
      )}

      {result.ok && queueCounts.ok ? (
        <AdminBookingsOperationsExtras
          queues={queueCounts.queues}
          activeFilter={filter}
          filter={filter}
          search={params.q}
          scheduledFrom={params.from}
          scheduledTo={params.to}
          matchTotal={result.matchTotal}
          returnedCount={result.returnedCount}
          limit={result.limit}
          capped={result.capped}
          subsetFiltered={result.subsetFiltered}
        />
      ) : null}
    </AdminDashboardShell>
  );
}
