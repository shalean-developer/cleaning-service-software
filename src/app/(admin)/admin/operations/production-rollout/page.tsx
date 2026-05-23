import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminProductionRolloutDashboard } from "@/components/dashboard/admin/AdminProductionRolloutDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { loadProductionRolloutStatus } from "@/features/production-rollout/server/productionRolloutReadModel";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Production rollout | Admin",
  description: "Staged finance and payment production rollout checklist.",
};

export default async function AdminProductionRolloutPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  let data;
  try {
    data = await loadProductionRolloutStatus();
  } catch {
    return (
      <AdminDashboardShell
        title="Production rollout"
        subtitle="Staged finance enablement and go-live checklist"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load production rollout status.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Production rollout"
      subtitle="Read-only rollout readiness, QA checklist, and monitoring"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminProductionRolloutDashboard data={data} />
    </AdminDashboardShell>
  );
}
