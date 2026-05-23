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
  computeAdminCustomerRegistryStats,
  filterAdminCustomersForRegistryView,
  normalizeAdminCustomerRegistryViewFilter,
} from "@/features/customers/server/admin/adminCustomersRegistryDisplay";
import { AdminCustomersRegistryHeader } from "@/components/dashboard/admin/customers/AdminCustomersRegistryHeader";
import { AdminCustomersRegistryStats } from "@/components/dashboard/admin/customers/AdminCustomersRegistryStats";
import { AdminCustomersRegistryToolbar } from "@/components/dashboard/admin/customers/AdminCustomersRegistryToolbar";
import { AdminCustomersRegistryList } from "@/components/dashboard/admin/customers/AdminCustomersRegistryList";

export const metadata: Metadata = {
  title: "Customers | Admin",
};

type PageProps = {
  searchParams: Promise<{
    view?: string;
    q?: string;
  }>;
};

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  const view = normalizeAdminCustomerRegistryViewFilter(params.view);
  const result = await listAdminCustomers(user, {
    page: 1,
    limit: 100,
    bookings: "all",
    health: "all",
    activity: "all",
  });

  const allItems = result.ok ? result.items : [];
  const displayedItems = result.ok
    ? filterAdminCustomersForRegistryView({
        items: allItems,
        view,
        search: params.q,
      })
    : [];

  const registryStats = result.ok ? computeAdminCustomerRegistryStats(allItems) : null;

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      <AdminCustomersRegistryHeader totalCount={result.ok ? allItems.length : 0} />

      {!result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "admin")}
          description={result.message}
        />
      ) : (
        <>
          {registryStats ? <AdminCustomersRegistryStats stats={registryStats} /> : null}

          <AdminCustomersRegistryToolbar view={view} search={params.q} />

          {displayedItems.length === 0 ? (
            <EmptyState
              title="No customers match this view"
              description={
                params.q || view !== "all"
                  ? "Try clearing search or choosing another filter."
                  : "Customers appear here once profiles are created."
              }
              action={
                params.q || view !== "all" ? (
                  <Link
                    href="/admin/customers"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Clear filters
                  </Link>
                ) : (
                  <Link
                    href="/admin/customers/new"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    New customer
                  </Link>
                )
              }
            />
          ) : (
            <AdminCustomersRegistryList items={displayedItems} />
          )}
        </>
      )}
    </AdminDashboardShell>
  );
}
