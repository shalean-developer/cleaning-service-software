import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCustomerBookings } from "@/features/dashboards/server/customerBookingReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { labelForCustomerBookingStatus } from "@/features/bookings/server/paymentFailureDisplay";
import {
  labelForPaymentStatus,
  toneForBookingStatus,
  toneForPaymentStatus,
} from "@/features/bookings/server/statusLabels";

export const metadata: Metadata = {
  title: "Customer | Cleaning Services",
};

export default async function CustomerHomePage() {
  const user = await getCurrentUser();
  const bookings = user ? await listCustomerBookings(user) : null;
  const allBookings = bookings?.ok ? bookings.bookings : [];
  const recent = [...allBookings]
    .sort((a, b) => {
      if (a.isUpcoming !== b.isUpcoming) return a.isUpcoming ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    })
    .slice(0, 3);

  return (
    <DashboardShell
      title="Your account"
      subtitle="Book cleans and track payment & assignment status."
      nav={[
        { href: "/customer", label: "Home" },
        { href: "/customer/bookings", label: "Bookings" },
        { href: "/customer/book", label: "Book a clean" },
      ]}
    >
      <Link
        href="/customer/book"
        className="mb-8 inline-flex rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white"
      >
        Book a clean
      </Link>

      <h2 className="text-sm font-semibold text-zinc-900">Recent bookings</h2>
      {recent.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-600">No bookings yet. Start with a new clean.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {recent.map((b) => (
            <li key={b.id}>
              <Link
                href={`/customer/bookings/${b.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300"
              >
                <section className="flex flex-wrap items-center gap-2">
                  <StatusBadge
                    label={labelForCustomerBookingStatus(b.status, b.paymentFailureReason)}
                    tone={toneForBookingStatus(b.status)}
                  />
                  {b.status !== "payment_failed" ? (
                    <StatusBadge
                      label={labelForPaymentStatus(b.paymentStatus)}
                      tone={toneForPaymentStatus(b.paymentStatus)}
                    />
                  ) : null}
                </section>
                <p className="mt-2 text-sm font-medium text-zinc-900">{b.display.serviceLabel}</p>
                <p className="text-sm text-zinc-600">{b.scheduleLabel}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardShell>
  );
}
