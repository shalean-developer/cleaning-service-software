import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { normalizeAdminEarningsPeriod } from "@/features/earnings/server/adminEarningsDisplay";
import { loadAdminEarningsView } from "@/features/earnings/server/adminEarningsReadModel";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminEarningsView } from "@/components/dashboard/admin/earnings/AdminEarningsView";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";

export const metadata: Metadata = {
  title: "Revenue & payouts | Admin",
};

type PageProps = {
  searchParams: Promise<{ period?: string }>;
};

export default async function AdminPayoutsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const params = await searchParams;
  const period = normalizeAdminEarningsPeriod(params.period);
  const result = await loadAdminEarningsView(user, period);

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      {!result.ok ? (
        <DashboardFetchError
          title={dashboardFetchErrorTitle("payouts", "admin")}
          description={result.message}
        />
      ) : (
        <AdminEarningsView view={result.view} />
      )}
    </AdminDashboardShell>
  );
}
