import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminCorporateStatementsDashboard } from "@/components/dashboard/admin/AdminCorporateStatementsDashboard";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { loadCorporateStatement } from "@/features/corporate-statements/server/corporateStatementReadModel";
import {
  CorporateStatementValidationError,
  parseCorporateStatementQueryParams,
  resolveCorporateStatementPeriodBounds,
} from "@/features/corporate-statements/server/parseCorporateStatementQueryParams";

export const metadata: Metadata = {
  title: "Corporate statements | Admin",
  description: "Monthly corporate client account statements.",
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

export default async function AdminCorporateStatementsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") redirect("/");

  const params = await searchParams;
  const customerEmail = readParam(params, "customerEmail");
  const customerName = readParam(params, "customerName");
  const zohoCustomerId = readParam(params, "zohoCustomerId");
  const hasCustomerIdentifier = Boolean(
    customerEmail?.trim() || customerName?.trim() || zohoCustomerId?.trim(),
  );

  const periodTypeParam = readParam(params, "periodType");
  const periodType = periodTypeParam === "custom" ? ("custom" as const) : ("monthly" as const);
  const fromParam = readParam(params, "from");
  const toParam = readParam(params, "to");
  const defaultBounds = resolveCorporateStatementPeriodBounds(periodType, fromParam, toParam);

  const formFilters = {
    customerEmail,
    customerName,
    zohoCustomerId,
    periodType,
    from: fromParam ? defaultBounds.periodStart : defaultBounds.periodStart,
    to: toParam ? defaultBounds.periodEnd : defaultBounds.periodEnd,
  };

  if (!hasCustomerIdentifier) {
    return (
      <AdminDashboardShell
        title="Corporate statements"
        subtitle="Monthly account statements for corporate clients"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <AdminCorporateStatementsDashboard
          data={null}
          filters={formFilters}
          hasCustomerIdentifier={false}
        />
      </AdminDashboardShell>
    );
  }

  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries({
    customerEmail,
    customerName,
    zohoCustomerId,
    periodType,
    from: fromParam,
    to: toParam,
    limit: readParam(params, "limit"),
  })) {
    if (value) urlParams.set(key, value);
  }

  let data;
  let filters;
  try {
    filters = parseCorporateStatementQueryParams(urlParams);
    data = await loadCorporateStatement(filters);
  } catch (error) {
    const message =
      error instanceof CorporateStatementValidationError
        ? error.message
        : "Could not load corporate statement.";
    return (
      <AdminDashboardShell
        title="Corporate statements"
        subtitle="Monthly account statements for corporate clients"
        nav={[...ADMIN_DASHBOARD_NAV]}
      >
        <AdminCorporateStatementsDashboard
          data={null}
          filters={formFilters}
          hasCustomerIdentifier={true}
        />
        <p className="mt-4 text-sm text-red-700">{message}</p>
      </AdminDashboardShell>
    );
  }

  return (
    <AdminDashboardShell
      title="Corporate statements"
      subtitle="Monthly account statements for corporate clients"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <AdminCorporateStatementsDashboard
        data={data}
        filters={filters}
        hasCustomerIdentifier={true}
      />
    </AdminDashboardShell>
  );
}
