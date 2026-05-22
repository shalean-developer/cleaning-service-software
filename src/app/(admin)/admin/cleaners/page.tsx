import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";
import { listAdminCleaners } from "@/features/cleaners/server/admin/adminCleanersReadModel";
import {
  computeAdminCleanerNetworkStats,
  filterAdminCleanersForNetworkView,
  normalizeAdminCleanerNetworkViewFilter,
} from "@/features/cleaners/server/admin/adminCleanersNetworkDisplay";
import { AdminCleanersNetworkHeader } from "@/components/dashboard/admin/cleaners/AdminCleanersNetworkHeader";
import { AdminCleanersNetworkStats } from "@/components/dashboard/admin/cleaners/AdminCleanersNetworkStats";
import { AdminCleanersNetworkToolbar } from "@/components/dashboard/admin/cleaners/AdminCleanersNetworkToolbar";
import { AdminCleanersNetworkGrid } from "@/components/dashboard/admin/cleaners/AdminCleanersNetworkGrid";

export const metadata: Metadata = {
  title: "Cleaners | Admin",
};

type PageProps = {
  searchParams: Promise<{ view?: string; q?: string }>;
};

export default async function AdminCleanersPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  const view = normalizeAdminCleanerNetworkViewFilter(params.view);
  const result = await listAdminCleaners(user, "all");

  const displayedItems =
    result.ok
      ? filterAdminCleanersForNetworkView({
          items: result.items,
          view,
          search: params.q,
        })
      : [];

  const networkStats = result.ok ? computeAdminCleanerNetworkStats(result.items) : null;

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      <AdminCleanersNetworkHeader
        totalCount={result.ok ? result.items.length : 0}
      />

      {!result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "admin")}
          description={result.message}
        />
      ) : (
        <>
          {networkStats ? (
            <AdminCleanersNetworkStats
              stats={networkStats}
              activeView={view}
              search={params.q}
            />
          ) : null}

          <AdminCleanersNetworkToolbar view={view} search={params.q} />

          {displayedItems.length === 0 ? (
            <EmptyState
              title="No cleaners match this view"
              description={
                params.q || view !== "all"
                  ? "Try clearing search or choosing another filter."
                  : "Cleaners appear here once profiles are created."
              }
              action={
                params.q || view !== "all" ? (
                  <Link
                    href="/admin/cleaners"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Clear filters
                  </Link>
                ) : (
                  <Link
                    href="/admin/cleaners/new"
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    Create cleaner
                  </Link>
                )
              }
            />
          ) : (
            <AdminCleanersNetworkGrid items={displayedItems} />
          )}
        </>
      )}
    </AdminDashboardShell>
  );
}
