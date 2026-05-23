import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminFinanceReconciliationDashboard } from "@/components/dashboard/admin/AdminFinanceReconciliationDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { loadFinanceReconciliation } from "@/features/finance-reconciliation/server/financeReconciliationReadModel";
import { parseFinanceReconciliationQueryParams } from "@/features/finance-reconciliation/server/parseFinanceReconciliationQueryParams";

export const metadata: Metadata = {
  title: "Finance reconciliation | Admin",
  description: "Compare Shalean, Paystack, and Zoho payment records.",
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const value = params[key];
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function AdminFinanceReconciliationPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const key of ["from", "to", "source", "status", "limit", "cursor"] as const) {
    const value = readParam(params, key);
    if (value) urlParams.set(key, value);
  }

  const filters = parseFinanceReconciliationQueryParams(urlParams);

  let data;
  try {
    data = await loadFinanceReconciliation(filters);
  } catch {
    return (
      <AdminDashboardShell
        title="Finance reconciliation"
        subtitle="Shalean · Paystack · Zoho"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load finance reconciliation data.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Finance reconciliation"
      subtitle="Read-only cross-system payment reconciliation"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminFinanceReconciliationDashboard
        data={data}
        filters={{
          from: filters.from,
          to: filters.to,
          source: filters.source ?? "all",
          status: filters.status ?? "all",
        }}
      />
    </AdminDashboardShell>
  );
}
