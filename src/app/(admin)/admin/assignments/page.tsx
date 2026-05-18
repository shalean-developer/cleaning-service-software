import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getDeferredAssignmentConfig } from "@/features/assignments/server/assignmentDispatchConfig";
import { getDeferredAssignmentDiagnostics } from "@/features/assignments/server/deferredAssignmentDiagnostics";
import { listAdminAssignmentQueue } from "@/features/dashboards/server/adminOperationsReadModel";
import { AdminDeferredAssignmentDiagnosticsPanel } from "@/components/dashboard/AdminDeferredAssignmentDiagnosticsPanel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminOperationalQueueCounts } from "@/features/dashboards/server/adminOperationalQueueCounts";
import { AdminAssignmentQueueStripFootnote } from "@/components/dashboard/AdminAssignmentQueueStripFootnote";
import { AdminOperationalQueueStrip } from "@/components/dashboard/AdminOperationalQueueStrip";
import { AdminAssignmentQueueGuidance } from "@/components/dashboard/AdminAssignmentQueueGuidance";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { ADMIN_QUEUE_CARD_CLASS } from "@/features/dashboards/adminDisplay";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  labelForAssignmentAttention,
  labelForBookingStatus,
  labelForOfferStatus,
  toneForBookingStatus,
  toneForOfferStatus,
} from "@/features/bookings/server/statusLabels";

export const metadata: Metadata = {
  title: "Assignments | Admin",
};

export default async function AdminAssignmentsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const client = await createSupabaseServerClient();
  const deferredConfig = getDeferredAssignmentConfig();

  const [result, queueCounts, deferredDiagnostics] = await Promise.all([
    listAdminAssignmentQueue(user),
    getAdminOperationalQueueCounts(user),
    client
      ? getDeferredAssignmentDiagnostics(client, { deferredEnabled: deferredConfig.enabled })
      : null,
  ]);

  return (
    <DashboardShell
      title="Assignment queue"
      subtitle="Dispatch attention and open offers."
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      {deferredDiagnostics ? (
        <AdminDeferredAssignmentDiagnosticsPanel diagnostics={deferredDiagnostics} />
      ) : null}

      {queueCounts.ok ? <AdminOperationalQueueStrip queues={queueCounts.queues} /> : null}

      {queueCounts.ok ? <AdminAssignmentQueueStripFootnote /> : null}

      {result.ok && result.total > 0 ? (
        <p className="mb-3 text-xs text-zinc-500">
          Showing {result.items.length} of {result.total}
          {result.total >= result.limit ? ` (limit ${result.limit})` : ""}
        </p>
      ) : null}

      {!result.ok || result.items.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          description="No bookings need assignment attention right now."
        />
      ) : (
        <ul className="space-y-2.5">
          {result.items.map((item) => (
            <li key={item.bookingId} className={ADMIN_QUEUE_CARD_CLASS}>
              <section className="flex flex-wrap items-center gap-1.5">
                <StatusBadge
                  label={labelForAssignmentAttention(
                    item.assignmentAttention,
                    item.assignmentReason,
                  )}
                  tone="warning"
                />
                <StatusBadge
                  label={labelForBookingStatus(item.status)}
                  tone={toneForBookingStatus(item.status)}
                />
              </section>
              <p className="mt-2 text-sm font-semibold text-zinc-900">{item.serviceLabel}</p>
              <p className="mt-0.5 text-sm text-zinc-600">
                {item.customerLabel} · {item.scheduleLabel}
              </p>
              {item.assignmentReason ? (
                <p className="mt-1.5 text-xs text-amber-900/90">{item.assignmentReason}</p>
              ) : null}

              <AdminAssignmentQueueGuidance item={item} />

              {item.openOffers.length > 0 ? (
                <section className="mt-3 border-t border-zinc-100 pt-3">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Open offers
                  </h3>
                  <ul className="mt-1.5 space-y-1.5 text-sm">
                    {item.openOffers.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={labelForOfferStatus(o.status)}
                          tone={toneForOfferStatus(o.status)}
                        />
                        <span>{o.cleanerName ?? o.cleanerId.slice(0, 8)}</span>
                        {o.expiresAt ? (
                          <span className="text-xs text-zinc-500">
                            expires {new Date(o.expiresAt).toLocaleString("en-ZA")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">No open offers</p>
              )}

              <Link
                href={`/admin/bookings/${item.bookingId}`}
                className="mt-3 inline-block text-sm font-medium text-zinc-700 hover:text-zinc-900"
              >
                Open booking →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
