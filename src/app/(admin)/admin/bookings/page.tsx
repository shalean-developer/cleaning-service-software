import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listAdminBookings } from "@/features/dashboards/server/adminOperationsReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  labelForAssignmentAttention,
  labelForBookingStatus,
  labelForPaymentStatus,
  toneForBookingStatus,
  toneForPaymentStatus,
} from "@/features/bookings/server/statusLabels";

export const metadata: Metadata = {
  title: "Bookings | Admin",
};

export default async function AdminBookingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await listAdminBookings(user);

  return (
    <DashboardShell
      title="All bookings"
      subtitle="Lifecycle, payment, and assignment state across customers."
      nav={[
        { href: "/admin", label: "Home" },
        { href: "/admin/bookings", label: "Bookings" },
        { href: "/admin/assignments", label: "Assignments" },
      ]}
    >
      {!result.ok || result.bookings.length === 0 ? (
        <EmptyState title="No bookings" description="Bookings will appear here as customers checkout." />
      ) : (
        <ul className="space-y-3">
          {result.bookings.map((b) => (
            <li key={b.id}>
              <Link
                href={`/admin/bookings/${b.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300"
              >
                <section className="flex flex-wrap gap-2">
                  <StatusBadge
                    label={labelForBookingStatus(b.status)}
                    tone={toneForBookingStatus(b.status)}
                  />
                  <StatusBadge
                    label={labelForPaymentStatus(b.paymentStatus)}
                    tone={toneForPaymentStatus(b.paymentStatus)}
                  />
                  {b.assignmentAttention === "attention_required" ? (
                    <StatusBadge
                      label={labelForAssignmentAttention("attention_required")}
                      tone="warning"
                    />
                  ) : null}
                </section>
                <p className="mt-2 font-medium text-zinc-900">{b.serviceLabel}</p>
                <p className="text-sm text-zinc-600">
                  {b.customerLabel}
                  {b.cleanerLabel ? ` · ${b.cleanerLabel}` : " · Unassigned"}
                </p>
                <p className="text-sm text-zinc-500">
                  {b.scheduleLabel} · {b.priceLabel}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
