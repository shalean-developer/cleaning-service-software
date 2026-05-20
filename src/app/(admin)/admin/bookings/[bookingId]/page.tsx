import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getAdminBookingDetail } from "@/features/dashboards/server/adminOperationsReadModel";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "@/components/dashboard/admin/AdminDashboardShell";
import { AdminDeferredDispatchPanel } from "@/components/dashboard/AdminDeferredDispatchPanel";
import { AdminOperationalStatusPanel } from "@/components/dashboard/AdminOperationalStatusPanel";
import { AdminPayoutActions } from "@/components/dashboard/AdminPayoutActions";
import { AdminTeamEarningsReconciliationPanel } from "@/components/dashboard/AdminTeamEarningsReconciliationPanel";
import { AdminOperationalTimeline } from "@/components/dashboard/AdminOperationalTimeline";
import { AdminBookingNotificationsSection } from "@/components/dashboard/AdminBookingNotificationsSection";
import {
  AdminBookingDetailHero,
  AdminPaymentFailureInset,
} from "@/components/dashboard/admin/AdminBookingDetailHero";
import { AdminBookingEarningsAttentionBanner } from "@/components/dashboard/admin/AdminBookingEarningsAttentionBanner";
import { AdminBookingDetailSectionNav } from "@/components/dashboard/admin/AdminBookingDetailSectionNav";
import { AdminBookingOperationalSummary } from "@/components/dashboard/admin/AdminBookingOperationalSummary";
import { AdminDetailSection } from "@/components/dashboard/admin/AdminDetailSection";
import { PastOffersCollapsible } from "@/components/dashboard/PastOffersCollapsible";
import { AdminTeamSupportOperationsPanel } from "@/components/dashboard/admin/AdminTeamSupportOperationsPanel";
import { AdminTeamRosterFoundationPanel } from "@/components/dashboard/admin/AdminTeamRosterFoundationPanel";
import { buildAdminOperationalLoadBadges } from "@/features/dashboards/server/adminTeamSupportObservation";
import {
  adminDeferredDispatchNeedsAttention,
  adminEarningsNeedsAttention,
  adminTeamSupportNeedsFollowUp,
  buildAdminBookingHeroContextRows,
  buildAdminBookingHeroEssentialRows,
  partitionAdminAssignmentOffers,
} from "@/features/dashboards/adminBookingDetailDisplay";
import {
  getAirbnbAdminBookingDetailCopy,
  getAirbnbAdminListBadges,
  isAirbnbOperationalBooking,
} from "@/features/dashboards/airbnbOperationalDisplay";
import {
  getDeepAdminBookingDetailCopy,
  getDeepAdminListBadges,
  isDeepOperationalBooking,
} from "@/features/dashboards/deepOperationalDisplay";
import {
  getCarpetAdminBookingDetailCopy,
  getCarpetAdminListBadges,
  isCarpetOperationalBooking,
} from "@/features/dashboards/carpetOperationalDisplay";
import {
  getMovingAdminBookingDetailCopy,
  getMovingAdminListBadges,
  isMovingOperationalBooking,
} from "@/features/dashboards/movingOperationalDisplay";
import {
  getOfficeAdminBookingDetailCopy,
  getOfficeAdminListBadges,
  isOfficeOperationalBooking,
} from "@/features/dashboards/officeOperationalDisplay";
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
  const paymentFailed = b.status === "payment_failed";
  const teamSupportFollowUp = adminTeamSupportNeedsFollowUp({
    isTwoCleanerRequest: b.observation.isTwoCleanerRequest,
    teamRequestFulfillment: b.observation.teamRequestFulfillment,
    teamSupportOps: b.observation.teamSupportOps,
  });
  const earningsAttention = adminEarningsNeedsAttention(b.teamEarningsReconciliation);
  const deferredAttention = adminDeferredDispatchNeedsAttention(b.deferredDispatch);
  const airbnb = isAirbnbOperationalBooking({
    serviceSlug: b.display.serviceSlug,
    serviceLabel: b.serviceLabel,
  });
  const office = isOfficeOperationalBooking({
    serviceSlug: b.display.serviceSlug,
    serviceLabel: b.serviceLabel,
  });
  const moving = isMovingOperationalBooking({
    serviceSlug: b.display.serviceSlug,
    serviceLabel: b.serviceLabel,
  });
  const deep = isDeepOperationalBooking({
    serviceSlug: b.display.serviceSlug,
    serviceLabel: b.serviceLabel,
  });
  const carpet = isCarpetOperationalBooking({
    serviceSlug: b.display.serviceSlug,
    serviceLabel: b.serviceLabel,
  });
  const opsDetail = airbnb
    ? getAirbnbAdminBookingDetailCopy()
    : office
      ? getOfficeAdminBookingDetailCopy()
      : moving
        ? getMovingAdminBookingDetailCopy()
        : deep
          ? getDeepAdminBookingDetailCopy()
          : carpet
            ? getCarpetAdminBookingDetailCopy()
            : null;

  const heroBadges = [
    { label: labelForBookingStatus(b.status), tone: toneForBookingStatus(b.status) },
    ...getAirbnbAdminListBadges({
      serviceLabel: b.serviceLabel,
      scheduledStart: b.scheduledStart,
    }).map((badge) => ({ label: badge.label, tone: badge.tone })),
    ...getMovingAdminListBadges({
      serviceLabel: b.serviceLabel,
      scheduledStart: b.scheduledStart,
    }).map((badge) => ({ label: badge.label, tone: badge.tone })),
    ...getOfficeAdminListBadges({
      serviceLabel: b.serviceLabel,
      scheduledStart: b.scheduledStart,
    }).map((badge) => ({ label: badge.label, tone: badge.tone })),
    ...getDeepAdminListBadges({
      serviceLabel: b.serviceLabel,
      scheduledStart: b.scheduledStart,
    }).map((badge) => ({ label: badge.label, tone: badge.tone })),
    ...getCarpetAdminListBadges({
      serviceLabel: b.serviceLabel,
      scheduledStart: b.scheduledStart,
    }).map((badge) => ({ label: badge.label, tone: badge.tone })),
    ...buildAdminOperationalLoadBadges(b.observation.operationalLoad).map((badge) => ({
      label: badge.label,
      tone: badge.tone,
    })),
    ...(paymentFailed
      ? [
          {
            label: labelForAdminPaymentFailureAttention(b.paymentFailureReason),
            tone: "warning" as const,
          },
        ]
      : [
          {
            label: labelForPaymentStatus(b.paymentStatus),
            tone: toneForPaymentStatus(b.paymentStatus),
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

  const essentialRows = buildAdminBookingHeroEssentialRows({
    scheduleLabel: b.scheduleLabel,
    locationSummary: b.display.locationSummary,
    customerLabel: b.customerLabel,
    cleanerLabel: b.cleanerLabel,
    priceLabel: b.priceLabel,
  });

  const { activeOffers, pastOffers } = partitionAdminAssignmentOffers(b.offers);

  const contextRows = buildAdminBookingHeroContextRows({
    serviceSlug: b.display.serviceSlug,
    serviceLabel: b.serviceLabel,
    customerPhone: b.customerPhone,
    homeSizeSummary: b.display.homeSizeSummary,
    cleaningIntensityLabel: b.display.cleaningIntensityLabel,
    equipmentSupplyLabel: b.display.equipmentSupplyLabel,
    teamSupportLabel: b.observation.isTwoCleanerRequest ? null : b.display.teamSupportLabel,
    teamRequestFulfillmentLabel: b.observation.isTwoCleanerRequest
      ? null
      : b.observation.teamRequestFulfillmentLabel,
    coordinationStatusLabel: b.observation.isTwoCleanerRequest
      ? null
      : b.observation.coordinationStatusLabel,
  });

  return (
    <AdminDashboardShell
      title="Booking"
      subtitle={opsDetail?.shellSubtitle ?? b.serviceLabel}
      nav={[...ADMIN_DASHBOARD_NAV]}
    >
      <Link
        href="/admin/bookings"
        className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
      >
        ← Bookings
      </Link>

      <section className={ADMIN_DETAIL_STACK_CLASS}>
        <AdminBookingDetailSectionNav />

        <div id="admin-booking-overview" className="scroll-mt-20 space-y-2.5 sm:space-y-3">
        <AdminBookingDetailHero
          serviceLabel={opsDetail?.heroHeadline ?? b.serviceLabel}
          bookingId={b.id}
          badges={heroBadges}
          essentialRows={essentialRows}
          contextRows={contextRows}
          contextSectionTitle={opsDetail?.contextSectionTitle}
          paymentAlert={
            paymentFailed ? (
              <AdminPaymentFailureInset>
                {opsDetail?.paymentFailedNote ??
                  "Payment did not complete. No assignment or earnings until payment succeeds."}
                {!opsDetail && b.paymentFailureReason === "checkout_expired"
                  ? " Checkout expired before Paystack confirmed."
                  : null}
              </AdminPaymentFailureInset>
            ) : undefined
          }
          footer={<AdminPayoutActions bookingId={b.id} status={b.status} />}
        />

        <AdminBookingOperationalSummary
          operational={b.operational}
          attentionFlags={{
            paymentFailed,
            deferredAttention,
            teamSupportFollowUp,
            earningsAttention,
          }}
        />

        {earningsAttention ? (
          <AdminBookingEarningsAttentionBanner reconciliation={b.teamEarningsReconciliation} />
        ) : null}

        {b.deferredDispatch && deferredAttention ? (
          <AdminDeferredDispatchPanel deferredDispatch={b.deferredDispatch} />
        ) : null}
        </div>

        <div id="admin-booking-assignment" className="scroll-mt-20 space-y-2.5 sm:space-y-3">
        <AdminOperationalStatusPanel bookingId={b.id} operational={b.operational} />

        {b.observation.isTwoCleanerRequest && teamSupportFollowUp ? (
          <AdminTeamSupportOperationsPanel
            bookingId={b.id}
            isTwoCleanerRequest={b.observation.isTwoCleanerRequest}
            assignedCleanerLabel={b.cleanerLabel}
            homeSizeSummary={b.display.homeSizeSummary}
            cleaningIntensityLabel={b.display.cleaningIntensityLabel}
            equipmentSupplyLabel={b.display.equipmentSupplyLabel}
            operationalLoad={b.observation.operationalLoad}
            teamRequestFulfillment={b.observation.teamRequestFulfillment}
            teamRequestFulfillmentLabel={b.observation.teamRequestFulfillmentLabel}
            initialTeamSupportOps={b.observation.teamSupportOps}
            initialCoordinationStatusLabel={b.observation.coordinationStatusLabel}
          />
        ) : null}

        {b.deferredDispatch && !deferredAttention ? (
          <AdminDetailSection title="Deferred assignment" collapsible>
            <AdminDeferredDispatchPanel deferredDispatch={b.deferredDispatch} embedded />
          </AdminDetailSection>
        ) : null}

        {b.observation.isTwoCleanerRequest && !teamSupportFollowUp ? (
          <AdminDetailSection title="Team support operations" collapsible tone="ops">
            <AdminTeamSupportOperationsPanel
              bookingId={b.id}
              isTwoCleanerRequest={b.observation.isTwoCleanerRequest}
              assignedCleanerLabel={b.cleanerLabel}
              homeSizeSummary={b.display.homeSizeSummary}
              cleaningIntensityLabel={b.display.cleaningIntensityLabel}
              equipmentSupplyLabel={b.display.equipmentSupplyLabel}
              operationalLoad={b.observation.operationalLoad}
              teamRequestFulfillment={b.observation.teamRequestFulfillment}
              teamRequestFulfillmentLabel={b.observation.teamRequestFulfillmentLabel}
              initialTeamSupportOps={b.observation.teamSupportOps}
              initialCoordinationStatusLabel={b.observation.coordinationStatusLabel}
              embedded
            />
          </AdminDetailSection>
        ) : null}

        <AdminTeamRosterFoundationPanel rows={b.teamRosterFoundation} />

        <AdminDetailSection
          title={opsDetail?.assignmentSectionTitle ?? "Assignment offers"}
          collapsible
        >
          {b.offers.length === 0 ? (
            <p className="text-sm text-zinc-600">No offers recorded.</p>
          ) : (
            <>
              {activeOffers.length > 0 ? (
                <ul className="space-y-1.5 text-sm">
                  {activeOffers.map((o) => (
                    <li
                      key={o.id}
                      className="flex min-w-0 flex-wrap items-center gap-2 border-b border-zinc-100 py-2 last:border-0"
                    >
                      <StatusBadge
                        label={labelForOfferStatus(o.status)}
                        tone={toneForOfferStatus(o.status)}
                      />
                      <span className="min-w-0 break-words">
                        {o.cleanerName ?? o.cleanerId.slice(0, 8)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(o.offeredAt).toLocaleString("en-ZA")}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-600">No open offers.</p>
              )}
              <PastOffersCollapsible count={pastOffers.length}>
                <ul className="space-y-1.5 text-sm">
                  {pastOffers.map((o) => (
                    <li
                      key={o.id}
                      className="flex min-w-0 flex-wrap items-center gap-2 border-b border-zinc-100 py-2 last:border-0"
                    >
                      <StatusBadge
                        label={labelForOfferStatus(o.status)}
                        tone={toneForOfferStatus(o.status)}
                      />
                      <span className="min-w-0 break-words">
                        {o.cleanerName ?? o.cleanerId.slice(0, 8)}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(o.offeredAt).toLocaleString("en-ZA")}
                      </span>
                    </li>
                  ))}
                </ul>
              </PastOffersCollapsible>
            </>
          )}
        </AdminDetailSection>
        </div>

        <div id="admin-booking-payments" className="scroll-mt-20 space-y-2.5 sm:space-y-3">
        <AdminDetailSection title="Earnings & payments" collapsible>
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
              <AdminTeamEarningsReconciliationPanel
                reconciliation={b.teamEarningsReconciliation}
              />
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
                    <li key={p.id} className="flex min-w-0 justify-between gap-4">
                      <span className="min-w-0 break-words text-zinc-800">
                        {labelForPaymentStatus(p.status)}
                        {p.providerRef ? (
                          <>
                            {" · "}
                            <span
                              className="font-mono text-xs text-zinc-600 [overflow-wrap:anywhere]"
                              title={p.providerRef}
                            >
                              {p.providerRef}
                            </span>
                          </>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatZar(p.amountCents, p.currency)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </section>
        </AdminDetailSection>
        </div>

        <div id="admin-booking-timeline" className="scroll-mt-20 space-y-2.5 sm:space-y-3">
        <AdminDetailSection
          title="Lifecycle"
          description={
            opsDetail?.lifecycleDescription ??
            "Customer-visible progress from payment through completion."
          }
          collapsible
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
          title="Admin operations log"
          description="Recovery, dispatch, and replace actions (internal)."
          tone="ops"
          collapsible
        >
          <AdminOperationalTimeline audits={b.operationalAudits} />
        </AdminDetailSection>
        </div>

        <div id="admin-booking-records" className="scroll-mt-20 space-y-2.5 sm:space-y-3">
        <AdminDetailSection
          title="Notifications"
          description="Outbox delivery for this booking (read-only)."
          collapsible
        >
          <AdminBookingNotificationsSection notifications={b.notifications} />
        </AdminDetailSection>
        </div>
      </section>
    </AdminDashboardShell>
  );
}
