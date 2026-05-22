import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";
import { listAdminCleanerApplications } from "@/features/cleaner-applications/server/adminCleanerApplicationsReadModel";
import type { AdminCleanerApplicationsFilter } from "@/features/cleaner-applications/server/adminCleanerApplicationsReadModel";
import { AdminCleanerApplicationsList } from "@/components/dashboard/admin/cleaner-applications/AdminCleanerApplicationsList";
import { AdminCleanerApplicationsToolbar } from "@/components/dashboard/admin/cleaner-applications/AdminCleanerApplicationsToolbar";

export const metadata: Metadata = {
  title: "Cleaner applications | Admin",
};

type PageProps = {
  searchParams: Promise<{ status?: string; q?: string }>;
};

function normalizeFilter(status?: string): AdminCleanerApplicationsFilter {
  const allowed = ["all", "new", "reviewing", "approved", "rejected", "duplicate"] as const;
  if (status && (allowed as readonly string[]).includes(status)) {
    return status as AdminCleanerApplicationsFilter;
  }
  return "all";
}

export default async function AdminCleanerApplicationsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  const filter = normalizeFilter(params.status);
  const result = await listAdminCleanerApplications(user, {
    filter,
    search: params.q,
  });

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-900">Cleaner applications</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Public apply funnel submissions — review before provisioning inactive cleaners.
          </p>
        </header>

        <Suspense fallback={null}>
          <AdminCleanerApplicationsToolbar
            currentFilter={filter}
            currentSearch={params.q ?? ""}
          />
        </Suspense>

        {!result.ok ? (
          <DashboardFetchError
            title={dashboardFetchErrorTitle("bookings", "admin")}
            description={result.message}
          />
        ) : (
          <AdminCleanerApplicationsList items={result.items} />
        )}
      </div>
    </AdminDashboardShell>
  );
}
