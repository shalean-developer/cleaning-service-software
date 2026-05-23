import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminAssistedProductionDashboard } from "@/components/dashboard/admin/AdminAssistedProductionDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { loadAdminAssistedProductionLearning } from "@/features/bookings/server/admin/loadAdminAssistedProductionLearning";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Admin-assisted production | Admin operations",
  description: "Live production observability for admin-assisted booking.",
};

export default async function AdminAssistedProductionPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  let learning;
  try {
    learning = await loadAdminAssistedProductionLearning();
  } catch {
    return (
      <AdminDashboardShell
        title="Admin-assisted production"
        subtitle="Live production observability"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load production status.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Admin-assisted production"
      subtitle="Live rollout health, incidents, and operational monitoring"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link
          href="/admin/operations/admin-assisted-bookings"
          className="font-medium text-sky-700 underline-offset-2 hover:underline"
        >
          Fleet diagnostics
        </Link>
        <Link
          href="/admin/operations/production-rollout"
          className="font-medium text-zinc-600 underline-offset-2 hover:underline"
        >
          Production rollout checklist
        </Link>
      </div>
      <AdminAssistedProductionDashboard status={learning.production} learning={learning} />
    </AdminDashboardShell>
  );
}
