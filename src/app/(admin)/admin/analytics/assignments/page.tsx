import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAdminAssignmentAnalyticsPage } from "@/features/assignments/server/assignmentAnalyticsReadModel";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminAssignmentAnalyticsPanel } from "@/components/dashboard/AdminAssignmentAnalyticsPanel";

export const metadata: Metadata = {
  title: "Assignment analytics | Admin",
};

export default async function AdminAssignmentAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await getAdminAssignmentAnalyticsPage(user);

  if (!result.ok) {
    if (result.status === 403) redirect("/");
    return (
      <AdminDashboardShell
        title="Assignment analytics"
        subtitle="Funnel performance"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">{result.message}</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Assignment analytics"
      subtitle="Read-only funnel metrics from offers and audit events. Does not change assignment behavior."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminAssignmentAnalyticsPanel analytics={result.page} />
    </AdminDashboardShell>
  );
}
