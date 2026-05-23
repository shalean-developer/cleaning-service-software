import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminZohoRefundCreditDiagnostics } from "@/components/dashboard/admin/AdminZohoRefundCreditDiagnostics";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { loadZohoRefundCreditDiagnostics } from "@/features/zoho-sales-sync/server/loadZohoRefundCreditDiagnostics";
import type { ZohoRefundCreditSyncStatus } from "@/lib/database/types";

export const metadata: Metadata = {
  title: "Zoho refunds | Admin",
  description: "Monitor Shalean refund and credit note sync to Zoho Books.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ALLOWED_STATUS = new Set<ZohoRefundCreditSyncStatus>(["pending", "synced", "failed"]);

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AdminZohoRefundsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  const params = await searchParams;
  const statusParam = readParam(params, "status")?.trim();
  const status =
    statusParam && ALLOWED_STATUS.has(statusParam as ZohoRefundCreditSyncStatus)
      ? (statusParam as ZohoRefundCreditSyncStatus)
      : undefined;

  let diagnostics;
  try {
    diagnostics = await loadZohoRefundCreditDiagnostics({ status, limit: 50 });
  } catch {
    return (
      <AdminDashboardShell
        title="Zoho refunds"
        subtitle="Refund and cancellation accounting in Zoho Books"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load Zoho refund/credit diagnostics.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Zoho refunds"
      subtitle="Accounting credit notes for refunds and cancellations."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminZohoRefundCreditDiagnostics diagnostics={diagnostics} />
    </AdminDashboardShell>
  );
}
