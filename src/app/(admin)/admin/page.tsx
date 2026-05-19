import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listAdminAssignmentQueue, listAdminBookings } from "@/features/dashboards/server/adminOperationsReadModel";
import { getAdminOperationalQueueCounts } from "@/features/dashboards/server/adminOperationalQueueCounts";
import { ADMIN_HOME_PREVIEW_LIMIT } from "@/features/dashboards/server/adminOperationalHelpers";
import { AdminOperationalQueueGuideDetails } from "@/components/dashboard/AdminOperationalQueueGuideDetails";
import { AdminOperationalQueueStrip } from "@/components/dashboard/AdminOperationalQueueStrip";
import { AdminBookingListCard } from "@/components/dashboard/admin/AdminBookingListCard";
import { buildAdminOperationalQueueCards } from "@/features/dashboards/adminOperationalQueues";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
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
  const bookings = user ? await listAdminBookings(user) : null;
  const queue = user ? await listAdminAssignmentQueue(user) : null;
  const queueCounts = user ? await getAdminOperationalQueueCounts(user) : null;

  const recent = bookings?.ok ? bookings.bookings.slice(0, 5) : [];
  const attention = queue?.ok ? queue.items.slice(0, ADMIN_HOME_PREVIEW_LIMIT) : [];
  const attentionTotal = queue?.ok ? queue.total : 0;

  return (
    <AdminDashboardShell
      title="Operations"
      subtitle="Queues, bookings, and assignment oversight."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      {queueCounts?.ok ? <AdminOperationalQueueStrip queues={queueCounts.queues} /> : null}

      {queueCounts?.ok ? (
        <AdminOperationalQueueGuideDetails
          cards={buildAdminOperationalQueueCards(queueCounts.queues)}
        />
      ) : null}

      {attention.length > 0 ? (
        <section className="mb-6">
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Needs attention</h2>
            <Link
              href="/admin/assignments"
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900"
            >
              Full queue ({attentionTotal}) →
            </Link>
          </header>
          <ul className="mt-2.5 space-y-2.5">
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
      ) : (
        <p className="mb-6 text-sm text-zinc-500">Assignment queue is clear.</p>
      )}

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
          <ul className="mt-2.5 space-y-2.5">
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
