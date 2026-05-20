import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCustomerBookingDetail } from "@/features/dashboards/server/customerBookingReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { CustomerDashboardHeaderEndLoader } from "@/components/dashboard/customer/CustomerDashboardHeaderEndLoader";
import { PaymentIssuePanel } from "@/components/dashboard/PaymentIssuePanel";
import { CustomerBookingDetailsCard } from "@/components/dashboard/customer/CustomerBookingDetailsCard";
import { CustomerBookingStatusHero } from "@/components/dashboard/customer/CustomerBookingStatusHero";
import { CustomerBookingWhatHappensNext } from "@/components/dashboard/customer/CustomerBookingWhatHappensNext";
import { CustomerLifecycleTimeline } from "@/components/dashboard/customer/CustomerLifecycleTimeline";
import {
  CUSTOMER_BOOKING_DETAIL_DISCLOSURE_CLASS,
  CUSTOMER_BOOKING_DETAIL_DISCLOSURE_SUMMARY_CLASS,
  shouldSuppressAssignmentCalloutInDetails,
} from "@/features/dashboards/customerBookingDetailDisplay";
import {
  getAirbnbCustomerBookingDetailCopy,
  isAirbnbCleaningSlug,
} from "@/features/dashboards/airbnbCustomerDisplay";
import { isDeepCleaningSlug } from "@/features/booking-wizard/deepCleaningDisplay";
import { isCarpetCleaningSlug } from "@/features/booking-wizard/carpetCleaningDisplay";
import { isMovingCleaningSlug } from "@/features/booking-wizard/movingCleaningDisplay";
import { isOfficeCleaningSlug } from "@/features/booking-wizard/officeCleaningDisplay";
import { getDeepCustomerBookingDetailCopy } from "@/features/dashboards/deepCustomerDisplay";
import { getCarpetCustomerBookingDetailCopy } from "@/features/dashboards/carpetCustomerDisplay";
import { getMovingCustomerBookingDetailCopy } from "@/features/dashboards/movingCustomerDisplay";
import { getOfficeCustomerBookingDetailCopy } from "@/features/dashboards/officeCustomerDisplay";
import {
  getRegularCustomerBookingDetailCopy,
  isRegularCleaningSlug,
} from "@/features/dashboards/regularCustomerDisplay";
import { CUSTOMER_DASHBOARD_NAV } from "@/features/dashboards/customerNav";

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
  const suppressAssignmentCallout = shouldSuppressAssignmentCalloutInDetails({
    deferredAssignmentMessage: b.deferredAssignmentMessage,
    assignmentCustomerMessage: b.display.assignmentCustomerMessage,
  });
  const serviceDetail = isAirbnbCleaningSlug(b.display.serviceSlug)
    ? getAirbnbCustomerBookingDetailCopy()
    : isOfficeCleaningSlug(b.display.serviceSlug)
      ? getOfficeCustomerBookingDetailCopy()
      : isMovingCleaningSlug(b.display.serviceSlug)
        ? getMovingCustomerBookingDetailCopy()
        : isDeepCleaningSlug(b.display.serviceSlug)
          ? getDeepCustomerBookingDetailCopy()
          : isCarpetCleaningSlug(b.display.serviceSlug)
            ? getCarpetCustomerBookingDetailCopy()
            : isRegularCleaningSlug(b.display.serviceSlug)
              ? getRegularCustomerBookingDetailCopy()
              : null;

  return (
    <DashboardShell
      title="Your booking"
      subtitle={serviceDetail?.shellSubtitle ?? "Status, payment, and service details"}
      nav={[...CUSTOMER_DASHBOARD_NAV]}
      headerEnd={<CustomerDashboardHeaderEndLoader />}
    >
      <Link
        href="/customer/bookings"
        className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
      >
        ← Back to bookings
      </Link>

      <section className="mt-3 space-y-2.5 sm:mt-4">
        <CustomerBookingStatusHero
          serviceSlug={b.display.serviceSlug}
          serviceLabel={b.display.serviceLabel}
          scheduleLabel={b.scheduleLabel}
          locationSummary={b.display.locationSummary}
          priceCents={b.priceCents}
          currency={b.currency}
          status={b.status}
          paymentStatus={b.paymentStatus}
          paymentFailureReason={b.paymentFailureReason}
          deferredAssignmentMessage={b.deferredAssignmentMessage}
          assignedCleanerLabel={b.assignedCleanerLabel}
          teamSupportLabel={b.display.teamSupportLabel}
        />

        {b.status === "payment_failed" ? (
          <PaymentIssuePanel
            bookingId={b.id}
            customerEmail={customerEmail}
            serviceSlug={b.display.serviceSlug}
            paymentFailureReason={b.paymentFailureReason}
            canRetryPayment={b.canRetryPayment}
          />
        ) : (
          <CustomerBookingWhatHappensNext
            status={b.status}
            serviceSlug={b.display.serviceSlug}
            deferredAssignmentMessage={b.deferredAssignmentMessage}
          />
        )}

        <details className={CUSTOMER_BOOKING_DETAIL_DISCLOSURE_CLASS}>
          <summary className={CUSTOMER_BOOKING_DETAIL_DISCLOSURE_SUMMARY_CLASS}>
            <span>{serviceDetail?.detailsSectionTitle ?? "Booking details"}</span>
            <span
              className="text-xs font-normal text-zinc-500 transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▾
            </span>
          </summary>
          <CustomerBookingDetailsCard
            serviceSlug={b.display.serviceSlug}
            homeSizeSummary={b.display.homeSizeSummary}
            cleaningIntensityLabel={b.display.cleaningIntensityLabel}
            equipmentSupplyLabel={b.display.equipmentSupplyLabel}
            frequencyLabel={b.display.frequencyLabel}
            addonsSummary={b.display.addonsSummary}
            teamSupportLabel={b.display.teamSupportLabel}
            teamSupportShownInHero={Boolean(b.display.teamSupportLabel)}
            cleanerPreferenceLabel={b.cleanerPreferenceLabel}
            assignedCleanerLabel={b.assignedCleanerLabel}
            assignedCleanerShownInHero={Boolean(b.assignedCleanerLabel)}
            assignmentCustomerMessage={b.display.assignmentCustomerMessage}
            suppressAssignmentCallout={suppressAssignmentCallout}
            specialInstructions={b.display.specialInstructions}
            contactPhoneDisplay={b.display.contactPhoneDisplay}
            priceCents={b.priceCents}
            currency={b.currency}
            payments={b.payments}
          />
        </details>

        <details className={CUSTOMER_BOOKING_DETAIL_DISCLOSURE_CLASS} open>
          <summary className={CUSTOMER_BOOKING_DETAIL_DISCLOSURE_SUMMARY_CLASS}>
            <span>{serviceDetail?.activitySectionTitle ?? "Activity"}</span>
            <span
              className="text-xs font-normal text-zinc-500 transition-transform group-open:rotate-180"
              aria-hidden
            >
              ▾
            </span>
          </summary>
          <div className="border-t border-zinc-100 px-4 pb-4 pt-1 sm:px-5 sm:pb-5">
            <CustomerLifecycleTimeline events={b.timeline} />
          </div>
        </details>
      </section>
    </DashboardShell>
  );
}
