import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";
import {
  listAdminCleaners,
  normalizeAdminCleanerFilter,
} from "@/features/cleaners/server/admin/adminCleanersReadModel";
import { AdminCleanersFilters } from "@/components/dashboard/admin/AdminCleanersFilters";
import { AdminCleanerListTable } from "@/components/dashboard/admin/AdminCleanerListTable";

export const metadata: Metadata = {
  title: "Cleaners | Admin",
};

type PageProps = {
  searchParams: Promise<{ filter?: string }>;
};

export default async function AdminCleanersPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  const filter = normalizeAdminCleanerFilter(params.filter);
  const result = await listAdminCleaners(user, filter);

  return (
    <AdminDashboardShell
      title="Cleaners"
      subtitle="Operational lifecycle, safety counts, and audit history."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <div className="mt-4">
        <Link
          href="/admin/cleaners/new"
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2"
        >
          Create cleaner
        </Link>
      </div>

      {!result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "admin")}
          description={result.message}
        />
      ) : (
        <>
          <AdminCleanersFilters filter={result.filter} totalCount={result.totalCount} />
          {result.items.length === 0 ? (
            <section className="mt-6">
              <EmptyState
                title="No cleaners match this filter"
                description="Try another operational state or view all cleaners."
              />
            </section>
          ) : (
            <AdminCleanerListTable items={result.items} />
          )}
        </>
      )}
    </AdminDashboardShell>
  );
}
