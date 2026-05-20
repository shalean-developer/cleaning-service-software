import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getDeferredAssignmentConfig } from "@/features/assignments/server/assignmentDispatchConfig";
import { getDeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import { getAdminPayoutSummary } from "@/features/earnings/server/payoutReadModel";
import { loadCronHealthReadModel } from "@/features/operations/server/cronHealthReadModel";
import { listAdminAssignmentQueue, listAdminBookings } from "@/features/dashboards/server/adminOperationsReadModel";
import { getAdminOperationalQueueCounts } from "@/features/dashboards/server/adminOperationalQueueCounts";
import { ADMIN_HOME_PREVIEW_LIMIT } from "@/features/dashboards/server/adminOperationalHelpers";
import { summarizeCronHealth } from "@/features/dashboards/adminAssignmentsPageDisplay";
import { AdminHomeOperationsCenter } from "@/components/dashboard/admin/AdminHomeOperationsCenter";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin | Cleaning Services",
};

export default async function AdminHomePage() {
  const user = await getCurrentUser();
  const client = user ? await createSupabaseServerClient() : null;
  const deferredConfig = getDeferredAssignmentConfig();

  const [bookings, queue, queueCounts, cronHealth, deferredDiagnostics, payoutSummary] = user
    ? await Promise.all([
        listAdminBookings(user),
        listAdminAssignmentQueue(user),
        getAdminOperationalQueueCounts(user),
        client ? loadCronHealthReadModel(client) : null,
        client
          ? getDeferredAssignmentDiagnostics(client, { deferredEnabled: deferredConfig.enabled })
          : null,
        getAdminPayoutSummary(user),
      ])
    : [null, null, null, null, null, null];

  const allBookings = bookings?.ok ? bookings.bookings : [];
  const recentBookings = allBookings.slice(0, 5);
  const attention = queue?.ok ? queue.items.slice(0, ADMIN_HOME_PREVIEW_LIMIT) : [];
  const attentionTotal = queue?.ok ? queue.total : 0;
  const cronSummary = cronHealth ? summarizeCronHealth(cronHealth.jobs) : null;
  const referenceNow = new Date().toISOString();

  return (
    <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>
      {queueCounts?.ok ? (
        <AdminHomeOperationsCenter
          referenceNow={referenceNow}
          queues={queueCounts.queues}
          cronSummary={cronSummary}
          criticalCronJobs={cronSummary?.criticalJobs ?? []}
          deferredDiagnostics={deferredDiagnostics}
          assignmentWorkQueueTotal={attentionTotal}
          payoutSummary={payoutSummary?.ok ? payoutSummary.summary : null}
          attention={attention}
          attentionTotal={attentionTotal}
          bookings={allBookings}
          recentBookings={recentBookings}
        />
      ) : null}
    </AdminDashboardShell>
  );
}
