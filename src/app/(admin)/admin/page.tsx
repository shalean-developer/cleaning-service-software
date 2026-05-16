import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import {
  listAdminAssignmentQueue,
  listAdminBookings,
} from "@/features/dashboards/server/adminOperationsReadModel";
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

  const recent = bookings?.ok ? bookings.bookings.slice(0, 5) : [];
  const attention = queue?.ok ? queue.items.slice(0, 5) : [];

  return (
    <DashboardShell
      title="Operations"
      subtitle="Bookings, payments, and assignment oversight."
      nav={[
        { href: "/admin", label: "Home" },
        { href: "/admin/bookings", label: "Bookings" },
        { href: "/admin/assignments", label: "Assignments" },
        { href: "/admin/payouts", label: "Payouts" },
      ]}
    >
      <section className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-semibold text-amber-900">Assignment attention</h2>
        <p className="mt-1 text-2xl font-semibold text-amber-950">{attention.length} shown</p>
        <Link
          href="/admin/assignments"
          className="mt-3 inline-block text-sm font-medium text-amber-900 hover:underline"
        >
          Open assignment queue →
        </Link>
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
                    label={labelForAssignmentAttention(item.assignmentAttention)}
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
