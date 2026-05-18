import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listCustomerBookings } from "@/features/dashboards/server/customerBookingReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardFetchError } from "@/components/dashboard/DashboardFetchError";
import { EmptyState } from "@/components/dashboard/EmptyState";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { customerBookingListCardLayers } from "@/features/dashboards/customerBookingListCardDisplay";

export const metadata: Metadata = {
  title: "My bookings | Customer",
};

export default async function CustomerBookingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const result = await listCustomerBookings(user);

  return (
    <DashboardShell
      title="My bookings"
      subtitle="Your cleans, payments, and cleaner assignment status."
      nav={[
        { href: "/customer", label: "Home" },
        { href: "/customer/bookings", label: "Bookings" },
        { href: "/customer/book", label: "Book a clean" },
      ]}
    >
      {!result.ok ? (
        <DashboardFetchError
          title="Could not load your bookings"
          description={result.message}
        />
      ) : result.bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="When you complete checkout, your bookings will appear here."
          action={
            <Link
              href="/customer/book"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
            >
              Book a clean
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {result.bookings.map((b) => {
            const layers = customerBookingListCardLayers(b);
            return (
              <li key={b.id}>
                <Link
                  href={`/customer/bookings/${b.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 hover:border-zinc-300"
                >
                  <section className="flex flex-wrap gap-2">
                    <StatusBadge
                      label={layers.dominantBadge.label}
                      tone={layers.dominantBadge.tone}
                    />
                  </section>
                  <p className="mt-2 font-medium text-zinc-900">{b.display.serviceLabel}</p>
                  <p className="text-sm text-zinc-600">{b.scheduleLabel}</p>
                  <p className="mt-1 text-sm text-zinc-500">{b.display.locationSummary}</p>
                  {layers.paymentStatusLine ? (
                    <p
                      className={
                        layers.paymentStatusLine.tone === "danger"
                          ? "mt-2 text-sm text-red-700"
                          : "mt-2 text-sm text-zinc-500"
                      }
                    >
                      {layers.paymentStatusLine.text}
                    </p>
                  ) : null}
                  {layers.supportingMessage?.kind === "assignment" ? (
                    <p className="mt-2 text-sm text-sky-800">{layers.supportingMessage.text}</p>
                  ) : layers.supportingMessage?.kind === "cleaner" ? (
                    <p className="mt-2 text-sm text-emerald-700">{layers.supportingMessage.text}</p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardShell>
  );
}
