import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  getAdminOperationsSummary,
  listAdminAssignmentQueue,
  listAdminBookings,
} from "@/features/dashboards/server/adminOperationsReadModel";
import { ADMIN_HOME_PREVIEW_LIMIT } from "@/features/dashboards/server/adminOperationalHelpers";
import { AdminOpsSummaryCards } from "@/components/dashboard/AdminOpsSummaryCards";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
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
  const opsSummary = user ? await getAdminOperationsSummary(user) : null;

  const recent = bookings?.ok ? bookings.bookings.slice(0, 5) : [];
  const attention = queue?.ok ? queue.items.slice(0, ADMIN_HOME_PREVIEW_LIMIT) : [];
  const attentionTotal = queue?.ok ? queue.total : 0;

  return (
    <DashboardShell
      title="Operations"
      subtitle="Bookings, payments, and assignment oversight."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      {opsSummary?.ok ? <AdminOpsSummaryCards summary={opsSummary.summary} /> : null}

      <section className="mb-6 text-sm text-zinc-600">
        {attentionTotal > 0 ? (
          <p>
            Assignment queue: showing {attention.length} of {attentionTotal} booking
            {attentionTotal === 1 ? "" : "s"}
            {attentionTotal > ADMIN_HOME_PREVIEW_LIMIT
              ? ` (preview limit ${ADMIN_HOME_PREVIEW_LIMIT} on home)`
              : ""}
            .
          </p>
        ) : (
          <p>Assignment queue is clear.</p>
        )}
      </section>

      {attention.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-zinc-900">Needs attention</h2>
          <ul className="mt-3 space-y-3">
            {attention.map((item) => (
              <li key={item.bookingId}>
                <Link
                  href={`/admin/bookings/${item.bookingId}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300"
                >
                  <StatusBadge
                    label={labelForAssignmentAttention(
                      item.assignmentAttention,
                      item.assignmentReason,
                    )}
                    tone="warning"
                  />
                  <p className="mt-2 font-medium text-zinc-900">{item.serviceLabel}</p>
                  <p className="text-sm text-zinc-600">
                    {item.customerLabel} · {item.scheduleLabel}
                  </p>
                  {item.openOffers.length > 0 ? (
                    <p className="mt-1 text-xs text-zinc-500">
                      {item.openOffers.length} open offer(s)
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <h2 className="text-sm font-semibold text-zinc-900">Recent bookings</h2>
      {recent.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">No bookings in the system yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {recent.map((b) => (
            <li key={b.id}>
              <Link
                href={`/admin/bookings/${b.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300"
              >
                <StatusBadge
                  label={labelForBookingStatus(b.status)}
                  tone={toneForBookingStatus(b.status)}
                />
                <p className="mt-2 font-medium text-zinc-900">{b.serviceLabel}</p>
                <p className="text-sm text-zinc-600">
                  {b.customerLabel}
                  {b.cleanerLabel ? ` · ${b.cleanerLabel}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
