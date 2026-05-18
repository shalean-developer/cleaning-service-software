import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAdminBookingDetail } from "@/features/dashboards/server/adminOperationsReadModel";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { AdminOperationalStatusPanel } from "@/components/dashboard/AdminOperationalStatusPanel";
import { AdminPayoutActions } from "@/components/dashboard/AdminPayoutActions";
import { AdminOperationalTimeline } from "@/components/dashboard/AdminOperationalTimeline";
import { AdminBookingNotificationsSection } from "@/components/dashboard/AdminBookingNotificationsSection";
import {
  AdminBookingDetailHero,
  AdminPaymentFailureInset,
} from "@/components/dashboard/admin/AdminBookingDetailHero";
import { AdminDetailSection } from "@/components/dashboard/admin/AdminDetailSection";
import { LifecycleTimeline } from "@/components/dashboard/LifecycleTimeline";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import { ADMIN_DETAIL_STACK_CLASS } from "@/features/dashboards/adminDisplay";
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

  const heroBadges = [
    { label: labelForBookingStatus(b.status), tone: toneForBookingStatus(b.status) },
    ...(b.status !== "payment_failed"
      ? [{ label: labelForPaymentStatus(b.paymentStatus), tone: toneForPaymentStatus(b.paymentStatus) }]
      : [
          {
            label: labelForAdminPaymentFailureAttention(b.paymentFailureReason),
            tone: "warning" as const,
          },
        ]),
    ...(b.assignmentVisibilityKey ?? b.assignmentAttention
      ? [
          {
            label: labelForAssignmentAttention(
              b.assignmentVisibilityKey ?? b.assignmentAttention,
            ),
            tone:
              b.assignmentVisibilityKey === "decline_redispatched" ||
              b.assignmentVisibilityKey === "finding_cleaner" ||
              b.assignmentVisibilityKey === "offer_sent"
                ? ("info" as const)
                : ("warning" as const),
          },
        ]
      : []),
  ];

  return (
    <DashboardShell
      title="Booking"
      subtitle={b.serviceLabel}
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <Link
        href="/admin/bookings"
        className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
      >
        ← Bookings
      </Link>

      <section className={ADMIN_DETAIL_STACK_CLASS}>
        <AdminBookingDetailHero
          serviceLabel={b.serviceLabel}
          bookingId={b.id}
          badges={heroBadges}
          rows={[
            { label: "When", value: b.scheduleLabel },
            { label: "Where", value: b.display.locationSummary },
            { label: "Customer", value: b.customerLabel },
            {
              label: "Cleaner",
              value: b.cleanerLabel ?? "Unassigned",
              valueClassName: b.cleanerLabel ? undefined : "text-zinc-500",
            },
            { label: "Total", value: b.priceLabel },
            {
              label: "Assignment",
              value: b.assignmentVisibilityKey
                ? labelForAssignmentAttention(b.assignmentVisibilityKey)
                : b.assignmentAttention
                  ? labelForAssignmentAttention(b.assignmentAttention)
                  : "No attention flag",
              valueClassName:
                b.assignmentVisibilityKey || b.assignmentAttention
                  ? undefined
                  : "text-zinc-500",
            },
          ]}
          paymentAlert={
            b.status === "payment_failed" ? (
              <AdminPaymentFailureInset>
                Payment did not complete
                {b.paymentFailureReason === "checkout_expired"
                  ? " — checkout expired before Paystack confirmed."
                  : "."}{" "}
                No assignment or earnings until payment succeeds.
              </AdminPaymentFailureInset>
            ) : undefined
          }
          footer={<AdminPayoutActions bookingId={b.id} status={b.status} />}
        />

        <AdminOperationalStatusPanel bookingId={b.id} operational={b.operational} />

        <AdminDetailSection title="Assignment offers">
          {b.offers.length === 0 ? (
            <p className="text-sm text-zinc-600">No offers recorded.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {b.offers.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-center gap-2 border-b border-zinc-100 py-2 last:border-0"
                >
                  <StatusBadge
                    label={labelForOfferStatus(o.status)}
                    tone={toneForOfferStatus(o.status)}
                  />
                  <span>{o.cleanerName ?? o.cleanerId.slice(0, 8)}</span>
                  <span className="text-xs text-zinc-500">
                    {new Date(o.offeredAt).toLocaleString("en-ZA")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminDetailSection>

        <AdminDetailSection title="Earnings & payments">
          <section className="space-y-4">
            <section>
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Earnings
              </h3>
              {b.earnings.length === 0 ? (
                <p className="mt-1.5 text-sm text-zinc-600">No earnings recorded yet.</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5 text-sm">
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
            <section className="border-t border-zinc-100 pt-3">
              <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Payments
              </h3>
              {b.payments.length === 0 ? (
                <p className="mt-1.5 text-sm text-zinc-600">No payments.</p>
              ) : (
                <ul className="mt-1.5 space-y-1.5 text-sm">
                  {b.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-4">
                      <span>
                        {labelForPaymentStatus(p.status)}
                        {p.providerRef ? ` · ${p.providerRef}` : ""}
                      </span>
                      <span className="tabular-nums">{formatZar(p.amountCents, p.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </section>
        </AdminDetailSection>

        <AdminDetailSection
          title="Lifecycle"
          description="Customer-visible progress from payment through completion."
        >
          <LifecycleTimeline events={b.timeline} />
        </AdminDetailSection>

        <AdminDetailSection
          title="Payment events"
          description="Webhook and provider events (read-only)."
          collapsible
        >
          {b.paymentEvents.length === 0 ? (
            <p className="text-sm text-zinc-600">No webhook events.</p>
          ) : (
            <ul className="space-y-1 text-sm text-zinc-600">
              {b.paymentEvents.map((e) => (
                <li key={e.id}>
                  {e.eventType ?? "event"} · {new Date(e.at).toLocaleString("en-ZA")}
                </li>
              ))}
            </ul>
          )}
        </AdminDetailSection>

        <AdminDetailSection
          title="State audit"
          description="Booking command history and state transitions."
          collapsible
        >
          {b.audits.length === 0 ? (
            <p className="text-sm text-zinc-600">No audit rows.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-zinc-700">
              {b.audits.map((a) => (
                <li
                  key={a.id}
                  className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2"
                >
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
        </AdminDetailSection>

        <AdminDetailSection
          title="Admin operations"
          description="Recovery, dispatch, and replace actions (internal)."
          tone="ops"
          collapsible
        >
          <AdminOperationalTimeline audits={b.operationalAudits} />
        </AdminDetailSection>

        <AdminDetailSection
          title="Notifications"
          description="Outbox delivery for this booking (read-only)."
          collapsible
        >
          <AdminBookingNotificationsSection notifications={b.notifications} />
        </AdminDetailSection>
      </section>
    </DashboardShell>
  );
}
