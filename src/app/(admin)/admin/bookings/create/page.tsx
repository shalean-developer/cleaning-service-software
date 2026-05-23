import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AdminBookingWizard } from "@/features/admin-booking-wizard/components/AdminBookingWizard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export const metadata: Metadata = {
  title: "Create booking (preview) | Admin",
  description: "Admin-assisted booking wizard — Phase 1 read-only preview",
};

export default async function AdminBookingsCreatePage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <AdminDashboardShell
      title="Create booking for customer"
      subtitle="Admin-assisted booking — read-only preview. No production mutations."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminBookingWizard />
    </AdminDashboardShell>
  );
}
