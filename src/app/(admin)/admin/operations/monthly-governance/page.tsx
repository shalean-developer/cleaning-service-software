import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminMonthlyGovernanceDashboard } from "@/components/dashboard/admin/AdminMonthlyGovernanceDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { loadMonthlyGovernanceDashboard } from "@/features/monthly-billing/server/loadMonthlyGovernanceDashboard";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Monthly governance | Admin",
  description: "Manual credit governance, exposure visibility, and account review workflows.",
};

export default async function AdminMonthlyGovernancePage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  let dashboard;
  try {
    dashboard = await loadMonthlyGovernanceDashboard();
  } catch {
    return (
      <AdminDashboardShell
        title="Monthly governance"
        subtitle="Credit limits, exposure tracking, and manual account controls"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load monthly governance data.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Monthly governance"
      subtitle="Manual finance governance for monthly account customers"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminMonthlyGovernanceDashboard dashboard={dashboard} />
    </AdminDashboardShell>
  );
}
