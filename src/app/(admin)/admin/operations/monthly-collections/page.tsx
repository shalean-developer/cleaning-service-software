import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminMonthlyCollectionsDashboard } from "@/components/dashboard/admin/AdminMonthlyCollectionsDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { loadMonthlyCollectionsDashboard } from "@/features/monthly-billing/server/loadMonthlyCollectionsDashboard";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Monthly collections | Admin",
  description: "Collections visibility, aging analytics, and finance workflow for monthly account invoices.",
};

export default async function AdminMonthlyCollectionsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  let dashboard;
  try {
    dashboard = await loadMonthlyCollectionsDashboard();
  } catch {
    return (
      <AdminDashboardShell
        title="Monthly collections"
        subtitle="Overdue visibility, aging analytics, and escalation recommendations"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load monthly collections data.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Monthly collections"
      subtitle="Delivery automation diagnostics, aging buckets, and account risk recommendations"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminMonthlyCollectionsDashboard dashboard={dashboard} />
    </AdminDashboardShell>
  );
}
