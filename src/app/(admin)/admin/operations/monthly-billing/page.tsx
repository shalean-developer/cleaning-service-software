import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminMonthlyBillingDashboard } from "@/components/dashboard/admin/AdminMonthlyBillingDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import {
  loadCustomerBillingAccountList,
  loadMonthlyBillingAccountsOverview,
} from "@/features/monthly-billing/server/customerBillingAccountReadModel";
import { loadMonthlyInvoiceBatchList } from "@/features/monthly-billing/server/monthlyInvoiceBatchReadModel";
import { loadMonthlyInvoiceAccrualDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoiceAccrualDiagnostics";
import { loadMonthlyInvoiceGenerationDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoiceGenerationDiagnostics";
import { loadMonthlyInvoicePaymentSyncDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoicePaymentSyncDiagnostics";
import { loadMonthlyInvoiceOperationsDiagnostics } from "@/features/monthly-billing/server/loadMonthlyInvoiceOperationsDiagnostics";
import { isZohoMonthlyAccountBillingEnabled } from "@/lib/app/zohoMonthlyAccountBillingFlag";
import { isZohoMonthlyInvoiceGenerationEnabled } from "@/lib/app/zohoMonthlyInvoiceGenerationFlag";
import { isZohoMonthlyInvoicePaymentSyncEnabled } from "@/lib/app/zohoMonthlyInvoicePaymentSyncFlag";
import { isZohoMonthlyInvoiceOperationsEnabled } from "@/lib/app/zohoMonthlyInvoiceOperationsFlag";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Monthly billing | Admin",
  description: "Read-only visibility for customer monthly billing accounts and invoice batches.",
};

export default async function AdminMonthlyBillingPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  let overview;
  let accounts;
  let batches;
  let accrual;
  let generation;
  let paymentSync;
  let operations;
  try {
    [overview, accounts, batches, accrual, generation, paymentSync, operations] = await Promise.all([
      loadMonthlyBillingAccountsOverview(),
      loadCustomerBillingAccountList(),
      loadMonthlyInvoiceBatchList(),
      loadMonthlyInvoiceAccrualDiagnostics(),
      loadMonthlyInvoiceGenerationDiagnostics(),
      loadMonthlyInvoicePaymentSyncDiagnostics(),
      loadMonthlyInvoiceOperationsDiagnostics(),
    ]);
  } catch {
    return (
      <AdminDashboardShell
        title="Monthly billing"
        subtitle="Read-only monthly account billing visibility"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load monthly billing data.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Monthly billing"
      subtitle="Monthly account billing, accrual, and Zoho invoice generation"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminMonthlyBillingDashboard
        overview={overview}
        accounts={accounts}
        batches={batches}
        accrual={accrual}
        generation={generation}
        paymentSync={paymentSync}
        operations={operations}
        setupEnabled={isZohoMonthlyAccountBillingEnabled()}
        generationEnabled={isZohoMonthlyInvoiceGenerationEnabled()}
        paymentSyncEnabled={isZohoMonthlyInvoicePaymentSyncEnabled()}
        operationsEnabled={isZohoMonthlyInvoiceOperationsEnabled()}
      />
    </AdminDashboardShell>
  );
}
