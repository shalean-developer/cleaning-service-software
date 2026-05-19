import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getDeferredAssignmentConfig } from "@/features/assignments/server/assignmentDispatchConfig";
import { getDeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import { loadCronHealthReadModel } from "@/features/operations/server/cronHealthReadModel";
import {
  AdminCronHealthCriticalBanner,
  AdminCronHealthPanel,
} from "@/components/dashboard/AdminCronHealthPanel";
import { listAdminAssignmentQueue } from "@/features/dashboards/server/adminOperationsReadModel";
import { AdminDeferredAssignmentDiagnosticsPanel } from "@/components/dashboard/AdminDeferredAssignmentDiagnosticsPanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminOperationalQueueCounts } from "@/features/dashboards/server/adminOperationalQueueCounts";
import { ADMIN_ASSIGNMENT_QUEUE_STRIP_FOOTNOTE_COPY } from "@/components/dashboard/AdminAssignmentQueueStripFootnote";
import { AdminOperationalQueueStrip } from "@/components/dashboard/AdminOperationalQueueStrip";
import { AdminAssignmentsOperationsHeader } from "@/components/dashboard/admin/AdminAssignmentsOperationsHeader";
import { AdminAssignmentsQueueWorkbench } from "@/components/dashboard/admin/AdminAssignmentsQueueWorkbench";
import { AdminDetailSection } from "@/components/dashboard/admin/AdminDetailSection";
import {
  deferredDiagnosticsNeedsAttention,
  summarizeCronHealth,
} from "@/features/dashboards/adminAssignmentsPageDisplay";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { ADMIN_DETAIL_STACK_CLASS } from "@/features/dashboards/adminDisplay";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";

export const metadata: Metadata = {
  title: "Assignments | Admin",
};

export default async function AdminAssignmentsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const client = await createSupabaseServerClient();
  const deferredConfig = getDeferredAssignmentConfig();

  const [result, queueCounts, deferredDiagnostics, cronHealth] = await Promise.all([
    listAdminAssignmentQueue(user),
    getAdminOperationalQueueCounts(user),
    client
      ? getDeferredAssignmentDiagnostics(client, { deferredEnabled: deferredConfig.enabled })
      : null,
    client ? loadCronHealthReadModel(client) : null,
  ]);

  const cronSummary = cronHealth ? summarizeCronHealth(cronHealth.jobs) : null;
  const diagnosticsOpen =
    cronSummary?.worstLevel === "critical" ||
    (deferredDiagnostics != null && deferredDiagnosticsNeedsAttention(deferredDiagnostics));

  return (
    <AdminDashboardShell
      title="Assignment queue"
      subtitle="Dispatch attention and open offers."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <section className={ADMIN_DETAIL_STACK_CLASS}>
        {queueCounts.ok ? (
          <AdminAssignmentsOperationsHeader
            workQueueCount={result.ok ? result.items.length : 0}
            workQueueTotal={result.ok ? result.total : 0}
            queues={queueCounts.queues}
            cronSummary={cronSummary}
            deferredDiagnostics={deferredDiagnostics}
          />
        ) : null}

        {cronSummary?.criticalJobs.length ? (
          <AdminCronHealthCriticalBanner jobs={cronSummary.criticalJobs} />
        ) : null}

        {result.ok ? (
          <AdminAssignmentsQueueWorkbench
            items={result.items}
            total={result.total}
            limit={result.limit}
          />
        ) : (
          <p className="text-sm text-zinc-600">Could not load assignment queue.</p>
        )}

        <details
          className="rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          open={diagnosticsOpen || undefined}
        >
          <summary className="cursor-pointer list-none px-4 py-3.5 text-sm font-medium text-zinc-800 marker:content-none [&::-webkit-details-marker]:hidden sm:px-5">
            Diagnostics &amp; queue reference
          </summary>
          <div className="space-y-2.5 border-t border-zinc-100 px-4 pb-4 pt-3 sm:px-5">
            {cronHealth ? (
              <AdminDetailSection title="Background job health" collapsible defaultOpen={cronSummary?.worstLevel === "critical"}>
                <AdminCronHealthPanel
                  generatedAt={cronHealth.generatedAt}
                  cronSecretConfigured={cronHealth.cronSecretConfigured}
                  jobs={cronHealth.jobs}
                  embedded
                />
              </AdminDetailSection>
            ) : null}

            {deferredDiagnostics ? (
              <AdminDetailSection
                title="Deferred assignment diagnostics"
                collapsible
                defaultOpen={deferredDiagnosticsNeedsAttention(deferredDiagnostics)}
              >
                <AdminDeferredAssignmentDiagnosticsPanel
                  diagnostics={deferredDiagnostics}
                  embedded
                />
              </AdminDetailSection>
            ) : null}

            {queueCounts.ok ? (
              <AdminDetailSection title="All operational queues" collapsible>
                <AdminOperationalQueueStrip queues={queueCounts.queues} compact />
                <p className="mt-3 text-xs leading-relaxed text-zinc-600">
                  {ADMIN_ASSIGNMENT_QUEUE_STRIP_FOOTNOTE_COPY}
                </p>
              </AdminDetailSection>
            ) : null}
          </div>
        </details>
      </section>
    </AdminDashboardShell>
  );
}
