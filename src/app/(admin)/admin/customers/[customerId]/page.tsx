import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { isUuid } from "@/lib/validation/uuid";
import AdminCreateCustomerPage from "../new/page";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { ADMIN_DETAIL_STACK_CLASS } from "@/features/dashboards/adminDisplay";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { AdminCustomerDetailSections } from "@/components/dashboard/admin/AdminCustomerDetailSections";
import { getAdminCustomerDetail } from "@/features/customers/server/admin/adminCustomersReadModel";
import { getCustomerOperationalTimeline } from "@/features/customers/server/admin/customerOperationalTimelineReadModel";
import { parseAdminCustomerDetailQueryParams } from "@/features/customers/server/admin/parseAdminCustomerDetailQuery";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";

type PageProps = {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ bookingFilter?: string }>;
};

function toDetailSearchParams(raw: Awaited<PageProps["searchParams"]>): URLSearchParams {
  const params = new URLSearchParams();
  if (raw.bookingFilter) params.set("bookingFilter", raw.bookingFilter);
  return params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { customerId } = await params;
  if (customerId === "new") {
    return { title: "Create customer | Admin" };
  }
  return { title: `Customer ${customerId.slice(0, 8)} | Admin` };
}

export default async function AdminCustomerDetailPage({ params, searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { customerId } = await params;
  if (customerId === "new") {
    return AdminCreateCustomerPage();
  }
  if (!isUuid(customerId)) {
    notFound();
  }

  const rawSearch = await searchParams;
  let bookingFilter;
  try {
    ({ bookingFilter } = parseAdminCustomerDetailQueryParams(toDetailSearchParams(rawSearch)));
  } catch {
    return (
      <AdminDashboardShell title="Customer" nav={[...ADMIN_DASHBOARD_NAV]}>
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "admin")}
          description="Invalid booking filter parameter."
        />
      </AdminDashboardShell>
    );
  }

  const [result, timelineResult] = await Promise.all([
    getAdminCustomerDetail(user, customerId),
    getCustomerOperationalTimeline(user, customerId),
  ]);

  if (!result.ok) {
    if (result.code === "CUSTOMER_NOT_FOUND") notFound();
    return (
      <AdminDashboardShell title="Customer" nav={[...ADMIN_DASHBOARD_NAV]}>
        <DashboardFetchError
          title={dashboardFetchErrorTitle("bookings", "admin")}
          description={result.message}
        />
      </AdminDashboardShell>
    );
  }

  const detail = result.detail;

  return (
    <AdminDashboardShell
      title={detail.companyName}
      subtitle="Customer operational view"
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <p className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/admin/customers" className="text-zinc-600 underline-offset-2 hover:underline">
          ← All customers
        </Link>
        <Link
          href={`/admin/customers/${customerId}/edit`}
          className="inline-flex min-h-9 items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Edit contact details
        </Link>
      </p>

      <div className={ADMIN_DETAIL_STACK_CLASS}>
        <AdminCustomerDetailSections
          detail={detail}
          timeline={timelineResult.ok ? timelineResult.events : []}
          timelineError={
            timelineResult.ok ? null : timelineResult.message
          }
          bookingFilter={bookingFilter}
        />
      </div>
    </AdminDashboardShell>
  );
}
