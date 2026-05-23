import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminTaxReportsDashboard } from "@/components/dashboard/admin/AdminTaxReportsDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { loadTaxReport } from "@/features/tax-reports/server/taxReportReadModel";
import { parseTaxReportQueryParams } from "@/features/tax-reports/server/parseTaxReportQueryParams";

export const metadata: Metadata = {
  title: "VAT / tax reports | Admin",
  description: "Read-only VAT and sales tax reporting exports for accountants.",
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

export default async function AdminTaxReportsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const key of ["periodType", "from", "to", "source", "limit", "includeUnresolved"] as const) {
    const value = readParam(params, key);
    if (value) urlParams.set(key, value);
  }

  const filters = parseTaxReportQueryParams(urlParams);

  let data;
  try {
    data = await loadTaxReport(filters);
  } catch {
    return (
      <AdminDashboardShell
        title="VAT / tax reports"
        subtitle="Sales tax readiness and VAT exports"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load tax report data.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="VAT / tax reports"
      subtitle="Read-only sales and VAT reporting for accountants"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminTaxReportsDashboard data={data} filters={filters} />
    </AdminDashboardShell>
  );
}
