import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCustomerBookingDetail } from "@/features/dashboards/server/customerBookingReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LifecycleTimeline } from "@/components/dashboard/LifecycleTimeline";
import { PaymentIssuePanel } from "@/components/dashboard/PaymentIssuePanel";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import { labelForCustomerBookingStatus } from "@/features/bookings/server/paymentFailureDisplay";
import {
  labelForPaymentStatus,
  toneForBookingStatus,
  toneForPaymentStatus,
} from "@/features/bookings/server/statusLabels";

type PageProps = { params: Promise<{ bookingId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { bookingId } = await params;
  return { title: `Booking ${bookingId.slice(0, 8)} | Customer` };
}

export default async function CustomerBookingDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { bookingId } = await params;
  const result = await getCustomerBookingDetail(user, bookingId);
  if (!result.ok) notFound();

  const b = result.booking;
  const customerEmail = user.authUser.email?.trim() ?? "";

  return (
    <DashboardShell
      title="Booking details"
      subtitle={b.display.serviceLabel}
      nav={[
        { href: "/customer", label: "Home" },
        { href: "/customer/bookings", label: "Bookings" },
        { href: "/customer/book", label: "Book a clean" },
      ]}
    >
      <Link href="/customer/bookings" className="text-sm text-zinc-600 hover:text-zinc-900">
        ← Back to bookings
      </Link>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <section className="flex flex-wrap gap-2">
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

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <section>
            <dt className="text-zinc-500">Schedule</dt>
            <dd className="font-medium text-zinc-900">{b.scheduleLabel}</dd>
          </section>
          <section>
            <dt className="text-zinc-500">Total</dt>
            <dd className="font-medium text-zinc-900">{formatZar(b.priceCents, b.currency)}</dd>
          </section>
          <section>
            <dt className="text-zinc-500">Location</dt>
            <dd className="font-medium text-zinc-900">{b.display.locationSummary}</dd>
          </section>
          <section>
            <dt className="text-zinc-500">Cleaner preference</dt>
            <dd className="font-medium text-zinc-900">{b.cleanerPreferenceLabel}</dd>
          </section>
          {b.assignedCleanerLabel ? (
            <section>
              <dt className="text-zinc-500">Assignment</dt>
              <dd className="font-medium text-emerald-700">{b.assignedCleanerLabel}</dd>
            </section>
          ) : null}
        </dl>

        {b.display.assignmentCustomerMessage ? (
          <p className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {b.display.assignmentCustomerMessage}
          </p>
        ) : null}

        {b.display.specialInstructions ? (
          <p className="mt-4 text-sm text-zinc-600">
            <span className="font-medium text-zinc-800">Notes:</span> {b.display.specialInstructions}
          </p>
        ) : null}
      </section>

      {b.status === "payment_failed" ? (
        <PaymentIssuePanel
          bookingId={b.id}
          customerEmail={customerEmail}
          paymentFailureReason={b.paymentFailureReason}
          canRetryPayment={b.canRetryPayment}
        />
      ) : null}

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Payments</h2>
        {b.payments.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No payment records.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {b.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-4">
                <span>
                  {labelForPaymentStatus(p.status)}
                  {p.providerRef ? ` · ${p.providerRef}` : ""}
                </span>
                <span>{formatZar(p.amountCents, p.currency)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Lifecycle</h2>
        <section className="mt-4">
          <LifecycleTimeline events={b.timeline} />
        </section>
      </section>
    </DashboardShell>
  );
}
