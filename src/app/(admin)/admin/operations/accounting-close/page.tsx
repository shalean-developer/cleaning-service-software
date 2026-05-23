import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminAccountingCloseDashboard } from "@/components/dashboard/admin/AdminAccountingCloseDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { loadAccountingClose } from "@/features/accounting-close/server/accountingCloseReadModel";
import { parseAccountingCloseQueryParams } from "@/features/accounting-close/server/parseAccountingCloseQueryParams";

export const metadata: Metadata = {
  title: "Accounting close | Admin",
  description: "Weekly and monthly finance period closing reports.",
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

export default async function AdminAccountingClosePage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  const params = await searchParams;
  const urlParams = new URLSearchParams();
  for (const key of ["periodType", "from", "to", "source", "limit"] as const) {
    const value = readParam(params, key);
    if (value) urlParams.set(key, value);
  }

  const filters = parseAccountingCloseQueryParams(urlParams);

  let data;
  try {
    data = await loadAccountingClose(filters);
  } catch {
    return (
      <AdminDashboardShell
        title="Accounting close"
        subtitle="Period closing reports"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <p className="text-sm text-red-700">Could not load accounting close data.</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Accounting close"
      subtitle="Read-only weekly and monthly finance period closing"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminAccountingCloseDashboard data={data} filters={filters} />
    </AdminDashboardShell>
  );
}
