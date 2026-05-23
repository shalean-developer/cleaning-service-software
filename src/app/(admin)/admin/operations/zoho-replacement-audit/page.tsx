import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminZohoReplacementAuditDashboard } from "@/components/dashboard/admin/AdminZohoReplacementAuditDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { loadZohoReplacementAudit } from "@/features/zoho-replacement-audit/server/zohoReplacementAuditReadModel";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Zoho replacement audit | Admin",
  description: "Read-only feasibility audit for replacing Zoho with Shalean-native accounting.",
};

export default async function AdminZohoReplacementAuditPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  let audit;
  try {
    ({ audit } = await loadZohoReplacementAudit());
  } catch {
    return (
      <AdminDashboardShell
        title="Zoho replacement audit"
        subtitle="Architectural feasibility and migration readiness"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load Zoho replacement audit.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Zoho replacement audit"
      subtitle="Read-only diagnostics for Zoho vs Shalean-native finance"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminZohoReplacementAuditDashboard audit={audit} />
    </AdminDashboardShell>
  );
}
