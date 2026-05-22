import type { Metadata } from "next";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";
import {
  listAdminSupportInbox,
  type AdminSupportInboxFilter,
} from "@/features/support/server/adminSupportInboxReadModel";
import { AdminSupportInboxSummaryCards } from "@/components/dashboard/admin/support/AdminSupportInboxSummaryCards";
import { AdminSupportInboxToolbar } from "@/components/dashboard/admin/support/AdminSupportInboxToolbar";
import {
  AdminSupportInboxList,
  AdminSupportInboxTriageBanner,
} from "@/components/dashboard/admin/support/AdminSupportInboxList";

export const metadata: Metadata = {
  title: "Support inbox | Admin",
};

type PageProps = {
  searchParams: Promise<{ filter?: string; q?: string }>;
};

function normalizeFilter(filter?: string): AdminSupportInboxFilter {
  const allowed = ["all", "open", "urgent", "booking", "recurring", "resolved"] as const;
  if (filter && (allowed as readonly string[]).includes(filter)) {
    return filter as AdminSupportInboxFilter;
  }
  return "all";
}

export default async function AdminSupportInboxPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  const filter = normalizeFilter(params.filter);
  const result = await listAdminSupportInbox(user, {
    filter,
    search: params.q,
  });

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-zinc-900">Support inbox</h1>
          <p className="mt-1 text-sm text-zinc-500">
            One-off booking and recurring customer requests — triage only, no automatic
            booking changes.
          </p>
        </header>

        <AdminSupportInboxTriageBanner />

        {result.ok ? <AdminSupportInboxSummaryCards summary={result.summary} /> : null}

        <Suspense fallback={null}>
          <AdminSupportInboxToolbar currentFilter={filter} currentSearch={params.q ?? ""} />
        </Suspense>

        {!result.ok ? (
          <DashboardFetchError
            title={dashboardFetchErrorTitle("bookings", "admin")}
            description={result.message}
          />
        ) : (
          <AdminSupportInboxList items={result.items} />
        )}
      </div>
    </AdminDashboardShell>
  );
}
