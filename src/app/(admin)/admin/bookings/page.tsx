import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listAdminBookings } from "@/features/dashboards/server/adminOperationsReadModel";
import { getAdminOperationalQueueCounts } from "@/features/dashboards/server/adminOperationalQueueCounts";
import { AdminOperationalQueueContextCard } from "@/components/dashboard/AdminOperationalQueueContextCard";
import { AdminOperationalQueueStrip } from "@/components/dashboard/AdminOperationalQueueStrip";
import { AdminBookingListCard } from "@/components/dashboard/admin/AdminBookingListCard";
import {
  buildAdminOperationalQueueContextCard,
  isAdminOperationalQueueFilter,
} from "@/features/dashboards/adminOperationalQueues";
import type { AdminBookingFilter } from "@/features/dashboards/server/adminOperationalHelpers";
import { adminBookingListBadges } from "@/features/dashboards/adminBookingListBadges";
import { AdminBookingsFilters } from "@/components/dashboard/AdminBookingsFilters";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";

export const metadata: Metadata = {
  title: "Bookings | Admin",
};

const VALID_FILTERS = new Set<AdminBookingFilter>([
  "payment_failed",
  "pending_assignment",
  "assignment_attention",
  "dispatch_not_started",
  "selected_declined",
  "max_attempts",
  "recovery_needed",
]);

type PageProps = {
  searchParams: Promise<{
    filter?: string;
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

  const [result, queueCounts] = await Promise.all([
    listAdminBookings(user, {
      filter,
      search: params.q,
      scheduledFrom: params.from,
      scheduledTo: params.to,
    }),
    getAdminOperationalQueueCounts(user),
  ]);

  const queueContextCard =
    queueCounts.ok && filter && isAdminOperationalQueueFilter(filter)
      ? buildAdminOperationalQueueContextCard(filter, queueCounts.queues)
      : null;

  return (
    <DashboardShell
      title="All bookings"
      subtitle="Lifecycle, payment, and assignment."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      {queueCounts.ok ? (
        <AdminOperationalQueueStrip queues={queueCounts.queues} activeFilter={filter} />
      ) : null}

      {queueContextCard ? <AdminOperationalQueueContextCard card={queueContextCard} /> : null}

      {result.ok ? (
        <AdminBookingsFilters
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

      {!result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "admin")}
          description={result.message}
        />
      ) : result.bookings.length === 0 ? (
        <EmptyState
          title="No matching bookings"
          description={
            filter || params.q
              ? "Try clearing filters or widening your search."
              : "Bookings appear here as customers checkout."
          }
          action={
            filter || params.q ? (
              <Link
                href="/admin/bookings"
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
              >
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {result.bookings.map((b) => (
            <li key={b.id}>
              <AdminBookingListCard
                href={`/admin/bookings/${b.id}`}
                badges={adminBookingListBadges(b)}
                title={b.serviceLabel}
                meta={`${b.customerLabel}${b.cleanerLabel ? ` · ${b.cleanerLabel}` : " · Unassigned"}`}
                secondary={`${b.scheduleLabel} · ${b.priceLabel}`}
                footnote={b.id}
              />
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
