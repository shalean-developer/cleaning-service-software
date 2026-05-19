import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAdminTeamSupportAnalytics } from "@/features/dashboards/server/adminOperationsReadModel";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
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
      <AdminDashboardShell
        title="Team support observation"
        subtitle="NF-7B.1 operational analytics"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">{result.message}</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Team support observation"
      subtitle="Track paid team support requests and admin follow-up. Display-only — no assignment or payout changes."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminTeamSupportAnalyticsPanel analytics={result.analytics} />
    </AdminDashboardShell>
  );
}
