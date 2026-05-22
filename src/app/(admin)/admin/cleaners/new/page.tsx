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
import { AdminCleanerCreateForm } from "@/components/dashboard/admin/AdminCleanerCreateForm";

export const metadata: Metadata = {
  title: "Create cleaner | Admin",
};

export default async function AdminCreateCleanerPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <AdminDashboardShell
      title="Create cleaner"
      subtitle="Add a cleaner profile for assignment and operations."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <nav className="text-sm" aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-zinc-600">
          <li>
            <Link href="/admin/cleaners" className="underline-offset-2 hover:underline">
              Cleaners
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
        <Link href="/admin/cleaners" className="text-zinc-600 underline-offset-2 hover:underline">
          ← Back to all cleaners
        </Link>
      </p>

      <div className={ADMIN_DETAIL_STACK_CLASS}>
        <AdminDetailSection
          title="Profile"
          description="Contact details and assignment eligibility. Lifecycle controls are not part of this form."
        >
          <AdminCleanerCreateForm />
        </AdminDetailSection>

        <p className={ADMIN_SECTION_MUTED_CLASS}>
          After a cleaner is created, use their detail page to deactivate, suspend, reactivate, or
          archive. those actions use audited lifecycle commands only.
        </p>
      </div>
    </AdminDashboardShell>
  );
}
