import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { isUuid } from "@/lib/validation/uuid";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { ADMIN_DETAIL_STACK_CLASS } from "@/features/dashboards/adminDisplay";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { AdminCustomerEditForm } from "@/components/dashboard/admin/AdminCustomerEditForm";
import { AdminDetailSection } from "@/components/dashboard/admin/AdminDetailSection";
import { getAdminCustomerDetail } from "@/features/customers/server/admin/adminCustomersReadModel";
import { dashboardFetchErrorTitle } from "@/lib/app/dashboardEcosystemDisplay";

type PageProps = {
  params: Promise<{ customerId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { customerId } = await params;
  return { title: `Edit customer ${customerId.slice(0, 8)} | Admin` };
}

export default async function AdminEditCustomerPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { customerId } = await params;
  if (!isUuid(customerId)) {
    notFound();
  }

  const result = await getAdminCustomerDetail(user, customerId);

  if (!result.ok) {
    if (result.code === "CUSTOMER_NOT_FOUND") notFound();
    return (
      <AdminDashboardShell title="Edit customer" nav={[...ADMIN_DASHBOARD_NAV]}>
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
      title="Edit customer"
      subtitle="Update company contact details only."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <nav className="text-sm" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-zinc-600">
          <li>
            <Link href="/admin/customers" className="underline-offset-2 hover:underline">
              Customers
            </Link>
          </li>
          <li aria-hidden className="text-zinc-400">
            /
          </li>
          <li>
            <Link
              href={`/admin/customers/${customerId}`}
              className="underline-offset-2 hover:underline"
            >
              {detail.companyName}
            </Link>
          </li>
          <li aria-hidden className="text-zinc-400">
            /
          </li>
          <li className="font-medium text-zinc-900" aria-current="page">
            Edit
          </li>
        </ol>
      </nav>

      <p className="mt-2 text-sm">
        <Link
          href={`/admin/customers/${customerId}`}
          className="text-zinc-600 underline-offset-2 hover:underline"
        >
          ← Back to customer detail
        </Link>
      </p>

      <div className={ADMIN_DETAIL_STACK_CLASS}>
        <AdminDetailSection
          title="Contact & company"
          description="Changes apply to the customer profile only. Bookings stay linked by customer ID."
        >
          <AdminCustomerEditForm
            initial={{
              customerId: detail.customerId,
              companyName: detail.companyName,
              phone: detail.phone ?? "",
              notes: detail.notes ?? "",
            }}
          />
        </AdminDetailSection>
      </div>
    </AdminDashboardShell>
  );
}
