import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminAssistedPilotQaDashboard } from "@/components/dashboard/admin/AdminAssistedPilotQaDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { loadAdminAssistedPilotQaPanel } from "@/features/bookings/server/admin/loadAdminAssistedPilotQaPanel";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Admin-assisted pilot QA | Admin operations",
  description: "Dry-run QA, friction tracking, and operator feedback for admin-assisted booking pilot.",
};

export default async function AdminAssistedPilotOperationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  let panel;
  try {
    panel = await loadAdminAssistedPilotQaPanel();
  } catch {
    return (
      <AdminDashboardShell
        title="Admin-assisted pilot QA"
        subtitle="Dry-run tooling and operator friction review"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load pilot QA panel.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Admin-assisted pilot QA"
      subtitle="Dry-run bookings, friction signals, and operator feedback"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link
          href="/admin/operations/admin-assisted-bookings"
          className="font-medium text-sky-700 underline-offset-2 hover:underline"
        >
          Operations dashboard
        </Link>
        <Link
          href="/admin/bookings/create"
          className="font-medium text-zinc-600 underline-offset-2 hover:underline"
        >
          Create assisted booking
        </Link>
      </div>
      <AdminAssistedPilotQaDashboard panel={panel} />
    </AdminDashboardShell>
  );
}
