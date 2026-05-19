import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import {
  ADMIN_DETAIL_STACK_CLASS,
  ADMIN_SECTION_MUTED_CLASS,
} from "@/features/dashboards/adminDisplay";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminDetailSection } from "@/components/dashboard/admin/AdminDetailSection";
import { AdminCustomerCreateForm } from "@/components/dashboard/admin/AdminCustomerCreateForm";

export const metadata: Metadata = {
  title: "Create customer | Admin",
};

export default async function AdminCreateCustomerPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <AdminDashboardShell
      title="Create customer"
      subtitle="Provision a customer identity for bookings and account access."
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
          <li className="font-medium text-zinc-900" aria-current="page">
            Create
          </li>
        </ol>
      </nav>

      <p className="mt-2 text-sm">
        <Link href="/admin/customers" className="text-zinc-600 underline-offset-2 hover:underline">
          ← Back to all customers
        </Link>
      </p>

      <div className={ADMIN_DETAIL_STACK_CLASS}>
        <AdminDetailSection
          title="Identity"
          description="Email and profile details. Bookings remain linked by customer ID, not email."
        >
          <AdminCustomerCreateForm />
        </AdminDetailSection>

        <p className={ADMIN_SECTION_MUTED_CLASS}>
          After creation you can review domain health and booking history on the customer detail
          page. Edit and delete flows are not available yet.
        </p>
      </div>
    </AdminDashboardShell>
  );
}
