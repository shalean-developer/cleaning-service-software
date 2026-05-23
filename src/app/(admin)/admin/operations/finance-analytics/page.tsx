import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminFinanceAnalyticsDashboard } from "@/components/dashboard/admin/AdminFinanceAnalyticsDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { loadFinanceAnalytics } from "@/features/finance-analytics/server/financeAnalyticsReadModel";
import { parseFinanceAnalyticsQueryParams } from "@/features/finance-analytics/server/parseFinanceAnalyticsQueryParams";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export const metadata: Metadata = {
  title: "Finance analytics | Admin",
  description: "Executive finance analytics and profitability dashboard.",
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

export default async function AdminFinanceAnalyticsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const key of ["periodType", "from", "to", "trendGranularity"] as const) {
    const value = readParam(params, key);
    if (value) urlParams.set(key, value);
  }

  const filters = parseFinanceAnalyticsQueryParams(urlParams);

  let data;
  try {
    data = await loadFinanceAnalytics(filters);
  } catch {
    return (
      <AdminDashboardShell
        title="Finance analytics"
        subtitle="Executive profitability and finance insights"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load finance analytics.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Finance analytics"
      subtitle="Read-only executive finance and profitability insights"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminFinanceAnalyticsDashboard data={data} filters={filters} />
    </AdminDashboardShell>
  );
}
