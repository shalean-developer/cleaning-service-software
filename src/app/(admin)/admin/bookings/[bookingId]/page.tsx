import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAdminBookingDetail } from "@/features/dashboards/server/adminOperationsReadModel";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AdminPayoutActions } from "@/components/dashboard/AdminPayoutActions";
import { AdminOperationalTimeline } from "@/components/dashboard/AdminOperationalTimeline";
import { AdminBookingNotificationsSection } from "@/components/dashboard/AdminBookingNotificationsSection";
import { LifecycleTimeline } from "@/components/dashboard/LifecycleTimeline";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import { labelForAdminPaymentFailureAttention } from "@/features/bookings/server/paymentFailureDisplay";
import {
  labelForAssignmentAttention,
  labelForBookingStatus,
  labelForOfferStatus,
  labelForPaymentStatus,
  labelForPayoutStatus,
  toneForBookingStatus,
  toneForOfferStatus,
  toneForPaymentStatus,
  toneForPayoutStatus,
} from "@/features/bookings/server/statusLabels";

type PageProps = { params: Promise<{ bookingId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { bookingId } = await params;
  return { title: `Booking ${bookingId.slice(0, 8)} | Admin` };
}

export default async function AdminBookingDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) return null;

  const { bookingId } = await params;
  const result = await getAdminBookingDetail(user, bookingId);
  if (!result.ok) notFound();

  const b = result.booking;

  return (
    <DashboardShell
      title="Booking operations"
      subtitle={b.serviceLabel}
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <Link href="/admin/bookings" className="text-sm text-zinc-600 hover:text-zinc-900">
        ← Back to bookings
      </Link>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <section className="flex flex-wrap gap-2">
          <StatusBadge label={labelForBookingStatus(b.status)} tone={toneForBookingStatus(b.status)} />
          <StatusBadge
            label={labelForPaymentStatus(b.paymentStatus)}
            tone={toneForPaymentStatus(b.paymentStatus)}
          />
          {b.status === "payment_failed" ? (
            <StatusBadge
              label={labelForAdminPaymentFailureAttention(b.paymentFailureReason)}
              tone="danger"
            />
          ) : null}
          {b.assignmentAttention ? (
            <StatusBadge
              label={labelForAssignmentAttention(b.assignmentAttention)}
              tone="warning"
            />
          ) : null}
        </section>

        {b.status === "payment_failed" ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            Payment did not complete
            {b.paymentFailureReason === "checkout_expired"
              ? " — checkout expired before Paystack confirmed payment."
              : "."}{" "}
            No assignment or earnings until the customer pays successfully.
          </p>
        ) : null}

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <section>
            <dt className="text-zinc-500">Customer</dt>
            <dd className="font-medium text-zinc-900">{b.customerLabel}</dd>
          </section>
          <section>
            <dt className="text-zinc-500">Cleaner</dt>
            <dd className="font-medium text-zinc-900">{b.cleanerLabel ?? "Unassigned"}</dd>
          </section>
          <section>
            <dt className="text-zinc-500">Schedule</dt>
            <dd className="font-medium text-zinc-900">{b.scheduleLabel}</dd>
          </section>
          <section>
            <dt className="text-zinc-500">Total</dt>
            <dd className="font-medium text-zinc-900">{b.priceLabel}</dd>
          </section>
          <section className="sm:col-span-2">
            <dt className="text-zinc-500">Location</dt>
            <dd className="font-medium text-zinc-900">{b.display.locationSummary}</dd>
          </section>
        </dl>

        <AdminPayoutActions bookingId={b.id} status={b.status} />
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Earnings</h2>
        {b.earnings.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No earnings recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {b.earnings.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={labelForPayoutStatus(e.payoutStatus)}
                  tone={toneForPayoutStatus(e.payoutStatus)}
                />
                <span>
                  {formatZar(e.payoutAmountCents)} of {formatZar(e.grossAmountCents)} gross
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Assignment offers</h2>
        {b.offers.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No offers recorded.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {b.offers.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 border-b border-zinc-100 py-2 last:border-0">
                <StatusBadge label={labelForOfferStatus(o.status)} tone={toneForOfferStatus(o.status)} />
                <span>{o.cleanerName ?? o.cleanerId.slice(0, 8)}</span>
                <span className="text-zinc-500">
                  {new Date(o.offeredAt).toLocaleString("en-ZA")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Payments</h2>
        {b.payments.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No payments.</p>
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
        <h2 className="text-sm font-semibold text-zinc-900">Payment events</h2>
        {b.paymentEvents.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No webhook events.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm text-zinc-600">
            {b.paymentEvents.map((e) => (
              <li key={e.id}>
                {e.eventType ?? "event"} · {new Date(e.at).toLocaleString("en-ZA")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">State audit</h2>
        {b.audits.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-600">No audit rows.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs text-zinc-700">
            {b.audits.map((a) => (
              <li key={a.id} className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
                <p className="font-medium text-zinc-900">
                  {a.displayTitle ?? a.command ?? "—"}
                </p>
                {a.displayDescription ? (
                  <p className="mt-0.5 text-zinc-600">{a.displayDescription}</p>
                ) : null}
                <p className="mt-1 font-mono text-[11px] text-zinc-500">
                  {a.command ?? "—"}: {a.from ?? "∅"} → {a.to ?? "∅"} @{" "}
                  {new Date(a.at).toLocaleString("en-ZA")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-amber-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Admin operations</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Internal admin actions (recovery, dispatch, replace). Admin-only — not shown to
          customers.
        </p>
        <AdminOperationalTimeline audits={b.operationalAudits} />
      </section>

      <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-6">
        <h2 className="text-sm font-semibold text-zinc-900">Notifications</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Outbox delivery history for this booking (read-only). Recipient email addresses are
          not shown. Retry and resend are not available yet.
        </p>
        <AdminBookingNotificationsSection notifications={b.notifications} />
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
