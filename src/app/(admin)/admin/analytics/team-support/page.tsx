import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAdminTeamSupportAnalytics } from "@/features/dashboards/server/adminOperationsReadModel";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AdminTeamSupportAnalyticsPanel } from "@/components/dashboard/admin/AdminTeamSupportAnalyticsPanel";

export const metadata: Metadata = {
  title: "Team support analytics | Admin",
};

export default async function AdminTeamSupportAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await getAdminTeamSupportAnalytics(user);

  if (!result.ok) {
    if (result.status === 403) redirect("/");
    return (
      <DashboardShell
        title="Team support observation"
        subtitle="NF-7B.1 operational analytics"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">{result.message}</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title="Team support observation"
      subtitle="Measure 2-cleaner requests before NF-7C architecture work. Display-only — no assignment or payout changes."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminTeamSupportAnalyticsPanel analytics={result.analytics} />
    </DashboardShell>
  );
}
