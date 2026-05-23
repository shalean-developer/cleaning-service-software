import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminZohoSalesSyncDiagnostics } from "@/components/dashboard/admin/AdminZohoSalesSyncDiagnostics";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { loadZohoSalesSyncDiagnostics } from "@/features/zoho-sales-sync/server/loadZohoSalesSyncDiagnostics";
import type { ZohoSalesSyncStatus } from "@/lib/database/types";

export const metadata: Metadata = {
  title: "Zoho sales sync | Admin",
  description: "Monitor Shalean sales sync to Zoho Books for accounting.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ALLOWED_STATUS = new Set<ZohoSalesSyncStatus>(["pending", "synced", "failed"]);

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AdminZohoSalesSyncPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  const params = await searchParams;
  const statusParam = readParam(params, "status")?.trim();
  const status =
    statusParam && ALLOWED_STATUS.has(statusParam as ZohoSalesSyncStatus)
      ? (statusParam as ZohoSalesSyncStatus)
      : undefined;

  let diagnostics;
  try {
    diagnostics = await loadZohoSalesSyncDiagnostics({ status, limit: 50 });
  } catch {
    return (
      <AdminDashboardShell
        title="Zoho sales sync"
        subtitle="Shalean paid sales → Zoho Books accounting"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load Zoho sales sync diagnostics.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Zoho sales sync"
      subtitle="Shalean as operational system, Zoho as accounting record."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminZohoSalesSyncDiagnostics diagnostics={diagnostics} />
    </AdminDashboardShell>
  );
}
