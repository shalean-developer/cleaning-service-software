import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getDeferredAssignmentConfig } from "@/features/assignments/server/assignmentDispatchConfig";
import { getDeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import { getAdminPayoutSummary } from "@/features/earnings/server/payoutReadModel";
import { loadCronHealthReadModel } from "@/features/operations/server/cronHealthReadModel";
import { listAdminAssignmentQueue, listAdminBookings } from "@/features/dashboards/server/adminOperationsReadModel";
import { getAdminOperationalQueueCounts } from "@/features/dashboards/server/adminOperationalQueueCounts";
import { ADMIN_HOME_PREVIEW_LIMIT } from "@/features/dashboards/server/adminOperationalHelpers";
import { summarizeCronHealth } from "@/features/dashboards/adminAssignmentsPageDisplay";
import { AdminHomeCommandCenter } from "@/components/dashboard/admin/AdminHomeCommandCenter";
import { AdminBookingListCard } from "@/components/dashboard/admin/AdminBookingListCard";
import { buildAdminOperationalQueueCards } from "@/features/dashboards/adminOperationalQueues";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  labelForAssignmentAttention,
  labelForBookingStatus,
  toneForBookingStatus,
} from "@/features/bookings/server/statusLabels";

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

  const recent = bookings?.ok ? bookings.bookings.slice(0, 5) : [];
  const attention = queue?.ok ? queue.items.slice(0, ADMIN_HOME_PREVIEW_LIMIT) : [];
  const attentionTotal = queue?.ok ? queue.total : 0;
  const cronSummary = cronHealth ? summarizeCronHealth(cronHealth.jobs) : null;
  const payoutQueueCount = payoutSummary?.ok ? payoutSummary.summary.queue.length : null;

  return (
    <AdminDashboardShell
      title="Operations"
      subtitle="Health at a glance — open a workbench to act."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      {queueCounts?.ok ? (
        <AdminHomeCommandCenter
          queues={queueCounts.queues}
          queueGuideCards={buildAdminOperationalQueueCards(queueCounts.queues)}
          cronSummary={cronSummary}
          criticalCronJobs={cronSummary?.criticalJobs ?? []}
          deferredDiagnostics={deferredDiagnostics}
          assignmentWorkQueueTotal={attentionTotal}
          payoutQueueCount={payoutQueueCount}
        />
      ) : null}

      {attention.length > 0 ? (
        <section className="mb-5">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Needs attention</h2>
            <Link
              href="/admin/assignments"
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              Workbench ({attentionTotal}) →
            </Link>
          </header>
          <ul className="mt-2 space-y-2">
            {attention.map((item) => (
              <li key={item.bookingId}>
                <AdminBookingListCard
                  href={`/admin/bookings/${item.bookingId}`}
                  badges={[
                    {
                      label: labelForAssignmentAttention(
                        item.assignmentAttention,
                        item.assignmentReason,
                      ),
                      tone: "warning",
                    },
                  ]}
                  title={item.serviceLabel}
                  meta={`${item.customerLabel} · ${item.scheduleLabel}`}
                  secondary={
                    item.openOffers.length > 0
                      ? `${item.openOffers.length} open offer${item.openOffers.length === 1 ? "" : "s"}`
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : queue?.ok ? (
        <p className="mb-5 text-sm text-zinc-500">Assignment work queue is clear.</p>
      ) : null}

      <section>
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Recent bookings</h2>
          <Link
            href="/admin/bookings"
            className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
          >
            View all →
          </Link>
        </header>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No bookings yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {recent.map((b) => (
              <li key={b.id}>
                <AdminBookingListCard
                  href={`/admin/bookings/${b.id}`}
                  badges={[
                    {
                      label: labelForBookingStatus(b.status),
                      tone: toneForBookingStatus(b.status),
                    },
                  ]}
                  title={b.serviceLabel}
                  meta={`${b.customerLabel}${b.cleanerLabel ? ` · ${b.cleanerLabel}` : ""}`}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminDashboardShell>
  );
}
