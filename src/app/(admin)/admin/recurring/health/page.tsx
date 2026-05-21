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
import { loadRecurringHealthReadModel } from "@/features/recurring/server/recurringHealthReadModel";
import { AdminRecurringHealthSummaryCards } from "@/components/dashboard/admin/recurring/AdminRecurringHealthSummaryCards";
import { AdminRecurringHealthPanel } from "@/components/dashboard/admin/recurring/AdminRecurringHealthPanel";

export const metadata: Metadata = {
  title: "Recurring health | Admin",
};

export default async function AdminRecurringHealthPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await loadRecurringHealthReadModel(user);

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      <header className="mb-5 space-y-1.5">
        <p className={ADMIN_OVERVIEW_SECTION_LABEL_CLASS}>Operate</p>
        <h1 className={`${ADMIN_OVERVIEW_SERIF_TITLE_CLASS} text-3xl sm:text-4xl`}>
          Recurring health
        </h1>
        <p className={ADMIN_OVERVIEW_MUTED_CLASS}>
          Operational monitoring for the recurring booking engine — read-only, no destructive
          actions.
        </p>
        <Link
          href="/admin/recurring"
          className="inline-block text-sm font-medium text-blue-700 hover:text-blue-900"
        >
          ← Recurring series
        </Link>
      </header>

      {!result.ok ? (
        <p className="text-sm text-red-800">{result.message}</p>
      ) : (
        <>
          <AdminRecurringHealthSummaryCards summary={result.model.summary} />
          <AdminRecurringHealthPanel model={result.model} />
        </>
      )}
    </AdminDashboardShell>
  );
}
