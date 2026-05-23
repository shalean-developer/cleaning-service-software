import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminZohoPaymentsWorkflow } from "@/components/dashboard/admin/AdminZohoPaymentsWorkflow";
import { AdminZohoInvoicePaymentsDiagnostics } from "@/components/dashboard/admin/AdminZohoInvoicePaymentsDiagnostics";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { AdminZohoSavedPaymentMethodsSummary } from "@/components/dashboard/admin/AdminZohoSavedPaymentMethodsSummary";
import { AdminZohoPaymentMethodManagement } from "@/components/dashboard/admin/AdminZohoPaymentMethodManagement";
import { AdminZohoLaunchStatusPanel } from "@/components/dashboard/admin/AdminZohoLaunchStatusPanel";
import { AdminZohoDailyPaymentChecks } from "@/components/dashboard/admin/AdminZohoDailyPaymentChecks";
import { AdminZohoPaymentAuditExportButton } from "@/components/dashboard/admin/AdminZohoPaymentAuditExportButton";
import { loadZohoInvoicePaymentDiagnostics } from "@/features/zoho-invoice-payments/server/loadZohoInvoicePaymentDiagnostics";
import { loadZohoInvoicePaymentMethodAdminSummary } from "@/features/zoho-invoice-payments/server/loadZohoInvoicePaymentMethodAdminSummary";
import { loadZohoPaymentGovernanceMetrics } from "@/features/zoho-invoice-payments/server/loadZohoPaymentGovernance";
import type { ZohoInvoicePaymentStatus } from "@/lib/database/types";

export const metadata: Metadata = {
  title: "Zoho invoice payments | Admin",
  description:
    "Generate Shalean payment links, check Zoho invoice status, and monitor Paystack reconciliation.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const ALLOWED_STATUS = new Set<ZohoInvoicePaymentStatus>([
  "pending_paystack",
  "paid",
  "failed",
  "zoho_reconcile_pending",
  "zoho_reconcile_failed",
]);

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AdminZohoPaymentsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  const params = await searchParams;
  const statusParam = readParam(params, "status")?.trim();
  const invoiceNumber = readParam(params, "invoiceNumber")?.trim();
  const limitParam = readParam(params, "limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;

  const status =
    statusParam && ALLOWED_STATUS.has(statusParam as ZohoInvoicePaymentStatus)
      ? (statusParam as ZohoInvoicePaymentStatus)
      : undefined;

  let diagnostics;
  let savedPaymentMethodsSummary;
  let governanceMetrics;
  try {
    [diagnostics, savedPaymentMethodsSummary, governanceMetrics] = await Promise.all([
      loadZohoInvoicePaymentDiagnostics({
        status,
        invoiceNumber: invoiceNumber || undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
      }),
      loadZohoInvoicePaymentMethodAdminSummary(),
      loadZohoPaymentGovernanceMetrics(),
    ]);
  } catch {
    return (
      <AdminDashboardShell
        title="Zoho invoice payments"
        subtitle="Manual invoice Paystack reconciliation health"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">
          Could not load Zoho invoice payment diagnostics.
        </p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Zoho invoice payments"
      subtitle="Generate payment links, copy customer messaging templates, and monitor Paystack reconciliation health."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <div className="space-y-8">
        <AdminZohoLaunchStatusPanel
          featureState={governanceMetrics.featureState}
          lastCronRun={governanceMetrics.lastCronRun}
        />
        <AdminZohoDailyPaymentChecks metrics={governanceMetrics} />
        <AdminZohoPaymentAuditExportButton />
        <AdminZohoPaymentsWorkflow
          initialInvoiceNumber={invoiceNumber ?? ""}
          adminCardChargesEnabled={governanceMetrics.featureState.adminCardChargesEnabled}
        />
        <AdminZohoSavedPaymentMethodsSummary summary={savedPaymentMethodsSummary} />
        <AdminZohoPaymentMethodManagement />
        <AdminZohoInvoicePaymentsDiagnostics diagnostics={diagnostics} />
      </div>
    </AdminDashboardShell>
  );
}
