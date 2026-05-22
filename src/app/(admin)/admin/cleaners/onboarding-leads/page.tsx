import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { ADMIN_SECTION_MUTED_CLASS } from "@/features/dashboards/adminDisplay";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminCleanerOnboardingLeadsTable } from "@/components/dashboard/admin/cleaners/AdminCleanerOnboardingLeadsTable";
import { loadCleanerOnboardingLeads } from "@/features/cleaners/server/admin/loadCleanerOnboardingLeads";

export const metadata: Metadata = {
  title: "Cleaner onboarding leads | Admin",
};

export default async function AdminCleanerOnboardingLeadsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const data = loadCleanerOnboardingLeads();

  return (
    <AdminDashboardShell
      title="Cleaner onboarding leads"
      subtitle="Review CSV import candidates before manual provisioning. No automatic auth or active cleaners."
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
            Onboarding leads
          </li>
        </ol>
      </nav>

      <p className="mt-2 text-sm">
        <Link href="/admin/cleaners" className="text-zinc-600 underline-offset-2 hover:underline">
          ← Back to all cleaners
        </Link>
      </p>

      <div className="mt-6 space-y-4">
        <p className={ADMIN_SECTION_MUTED_CLASS}>
          Read-only review UI. Leads are not inserted into cleaners, auth, or assignment pools.
          Use Create cleaner to open the existing provision flow with name and phone prefilled.
          Existing cleaners (e.g. Princess Saidi) are excluded from the import file.
        </p>

        {!data.ok ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            <p className="font-medium">Import files not found</p>
            <p className="mt-1">{data.message}</p>
            <p className="mt-2 font-mono text-xs">npm run import:cleaners:onboarding-leads</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600">
              <span>
                <strong className="text-zinc-900">{data.leads.length}</strong> invite lead
                {data.leads.length === 1 ? "" : "s"}
              </span>
              <span className="text-zinc-300" aria-hidden>
                ·
              </span>
              <span>
                Source:{" "}
                <span className="font-medium text-zinc-800">
                  {data.source === "json" ? "cleaner-onboarding-leads-report.json" : "cleaner-onboarding-leads.csv"}
                </span>
              </span>
              {data.generatedAt ? (
                <>
                  <span className="text-zinc-300" aria-hidden>
                    ·
                  </span>
                  <time dateTime={data.generatedAt}>
                    Generated {new Date(data.generatedAt).toLocaleString("en-ZA")}
                  </time>
                </>
              ) : null}
              {data.reportSummary ? (
                <>
                  <span className="text-zinc-300" aria-hidden>
                    ·
                  </span>
                  <span>
                    Import batch: {data.reportSummary.totalRows} processed,{" "}
                    {data.reportSummary.existingCleaner} skipped as existing
                  </span>
                </>
              ) : null}
            </div>

            <AdminCleanerOnboardingLeadsTable leads={data.leads} />
          </>
        )}
      </div>
    </AdminDashboardShell>
  );
}
