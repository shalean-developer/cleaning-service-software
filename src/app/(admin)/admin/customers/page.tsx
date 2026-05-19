import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";
import { listAdminCustomers } from "@/features/customers/server/admin/adminCustomersReadModel";
import {
  adminCustomersEmptyState,
  adminCustomersFilterSummary,
} from "@/features/customers/server/admin/adminCustomersListDisplay";
import { buildAdminCustomersListHref } from "@/features/customers/server/admin/buildAdminCustomersListHref";
import { parseAdminCustomersQueryParams } from "@/features/customers/server/admin/parseAdminCustomersQuery";
import { AdminCustomerListTable } from "@/components/dashboard/admin/AdminCustomerListTable";
import { AdminCustomersSearchForm } from "@/components/dashboard/admin/AdminCustomersSearchForm";

export const metadata: Metadata = {
  title: "Customers | Admin",
};

type PageProps = {
  searchParams: Promise<{
    page?: string;
    limit?: string;
    q?: string;
    bookings?: string;
    health?: string;
    activity?: string;
  }>;
};

function toUrlSearchParams(raw: Awaited<PageProps["searchParams"]>): URLSearchParams {
  const params = new URLSearchParams();
  if (raw.page) params.set("page", raw.page);
  if (raw.limit) params.set("limit", raw.limit);
  if (raw.q) params.set("q", raw.q);
  if (raw.bookings) params.set("bookings", raw.bookings);
  if (raw.health) params.set("health", raw.health);
  if (raw.activity) params.set("activity", raw.activity);
  return params;
}

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const raw = await searchParams;
  let query;
  try {
    query = parseAdminCustomersQueryParams(toUrlSearchParams(raw));
  } catch {
    return (
      <AdminDashboardShell title="Customers" nav={[...ADMIN_DASHBOARD_NAV]}>
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "admin")}
          description="Invalid search, filter, or pagination parameters."
        />
      </AdminDashboardShell>
    );
  }

  const result = await listAdminCustomers(user, query);
  const emptyState = adminCustomersEmptyState(query);

  return (
    <AdminDashboardShell
      title="Customers"
      subtitle="Customer directory — identity, bookings, and domain health."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <div className="mt-4">
        <Link
          href="/admin/customers/new"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        >
          New customer
        </Link>
      </div>

      <AdminCustomersSearchForm query={query} />

      {!result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "admin")}
          description={result.message}
        />
      ) : (
        <>
          <p className="mt-4 text-sm text-zinc-600">
            {result.matchTotal} customer(s)
            {adminCustomersFilterSummary(query)}
            {result.capped ? " · results capped at 2,000" : ""}
          </p>

          {result.items.length === 0 ? (
            <section className="mt-6">
              <EmptyState title={emptyState.title} description={emptyState.description} />
            </section>
          ) : (
            <AdminCustomerListTable items={result.items} />
          )}

          {result.matchTotal > result.limit ? (
            <nav
              className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-sm"
              aria-label="Customer list pagination"
            >
              <span className="text-zinc-600">
                Page {result.page} · showing {result.returnedCount} of {result.matchTotal}
              </span>
              <div className="flex gap-2">
                {result.page > 1 ? (
                  <Link
                    href={buildAdminCustomersListHref({
                      ...query,
                      page: result.page - 1,
                    })}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
                  >
                    Previous
                  </Link>
                ) : null}
                {result.page * result.limit < result.matchTotal ? (
                  <Link
                    href={buildAdminCustomersListHref({
                      ...query,
                      page: result.page + 1,
                    })}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 hover:bg-zinc-50"
                  >
                    Next
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </AdminDashboardShell>
  );
}
