import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listAdminAssignmentQueue } from "@/features/dashboards/server/adminOperationsReadModel";
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

  const result = await listAdminAssignmentQueue(user);

  return (
    <DashboardShell
      title="Assignment queue"
      subtitle="Bookings needing dispatch attention or with open offers."
      nav={[
        { href: "/admin", label: "Home" },
        { href: "/admin/bookings", label: "Bookings" },
        { href: "/admin/assignments", label: "Assignments" },
      ]}
    >
      {!result.ok || result.items.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          description="No bookings currently need assignment attention."
        />
      ) : (
        <ul className="space-y-4">
          {result.items.map((item) => (
            <li
              key={item.bookingId}
              className="rounded-xl border border-zinc-200 bg-white p-5"
            >
              <section className="flex flex-wrap gap-2">
                <StatusBadge
                  label={labelForAssignmentAttention(item.assignmentAttention)}
                  tone="warning"
                />
                <StatusBadge
                  label={labelForBookingStatus(item.status)}
                  tone={toneForBookingStatus(item.status)}
                />
              </section>
              <p className="mt-3 font-medium text-zinc-900">{item.serviceLabel}</p>
              <p className="text-sm text-zinc-600">
                {item.customerLabel} · {item.scheduleLabel}
              </p>
              {item.assignmentReason ? (
                <p className="mt-2 text-sm text-amber-800">{item.assignmentReason}</p>
              ) : null}

              {item.openOffers.length > 0 ? (
                <section className="mt-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Open offers
                  </h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {item.openOffers.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center gap-2">
                        <StatusBadge
                          label={labelForOfferStatus(o.status)}
                          tone={toneForOfferStatus(o.status)}
                        />
                        <span>{o.cleanerName ?? o.cleanerId.slice(0, 8)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">No open offers</p>
              )}

              <Link
                href={`/admin/bookings/${item.bookingId}`}
                className="mt-4 inline-block text-sm font-medium text-zinc-700 hover:text-zinc-900"
              >
                View booking →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
