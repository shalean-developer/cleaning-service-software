import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminAssistedBookingOperationsDashboard } from "@/components/dashboard/admin/AdminAssistedBookingOperationsDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { loadAdminAssistedBookingDiagnostics } from "@/features/bookings/server/admin/adminAssistedBookingDiagnosticsReadModel";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Admin-assisted bookings | Admin operations",
  description: "Internal pilot diagnostics and payment-request analytics for admin-assisted booking.",
};

export default async function AdminAssistedBookingsOperationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  let diagnostics;
  try {
    diagnostics = await loadAdminAssistedBookingDiagnostics();
  } catch {
    return (
      <AdminDashboardShell
        title="Admin-assisted bookings"
        subtitle="Internal pilot operations dashboard"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load admin-assisted booking diagnostics.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Admin-assisted bookings"
      subtitle="Read-only pilot diagnostics, analytics, and operator support"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link href="/admin/bookings/create" className="font-medium text-sky-700 underline-offset-2 hover:underline">
          Open booking wizard
        </Link>
        <Link
          href="/admin/operations/production-rollout"
          className="font-medium text-zinc-600 underline-offset-2 hover:underline"
        >
          Production rollout checklist
        </Link>
      </div>
      <AdminAssistedBookingOperationsDashboard diagnostics={diagnostics} />
    </AdminDashboardShell>
  );
}
