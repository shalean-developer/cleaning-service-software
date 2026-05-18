import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getCustomerBookingDetail } from "@/features/dashboards/server/customerBookingReadModel";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { PaymentIssuePanel } from "@/components/dashboard/PaymentIssuePanel";
import { CustomerBookingDetailsCard } from "@/components/dashboard/customer/CustomerBookingDetailsCard";
import { CustomerBookingStatusHero } from "@/components/dashboard/customer/CustomerBookingStatusHero";
import { CustomerBookingWhatHappensNext } from "@/components/dashboard/customer/CustomerBookingWhatHappensNext";
import { CustomerLifecycleTimeline } from "@/components/dashboard/customer/CustomerLifecycleTimeline";
import { CUSTOMER_BOOKING_DETAIL_CARD_CLASS } from "@/features/dashboards/customerBookingDetailDisplay";

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
      title="Your booking"
      subtitle="Track payment, assignment, and service details in one place."
      nav={[
        { href: "/customer", label: "Home" },
        { href: "/customer/bookings", label: "Bookings" },
        { href: "/customer/book", label: "Book a clean" },
      ]}
    >
      <Link
        href="/customer/bookings"
        className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
      >
        ← Back to bookings
      </Link>

      <section className="mt-4 space-y-3 sm:mt-5 sm:space-y-4">
        <CustomerBookingStatusHero
          serviceLabel={b.display.serviceLabel}
          scheduleLabel={b.scheduleLabel}
          locationSummary={b.display.locationSummary}
          priceCents={b.priceCents}
          currency={b.currency}
          status={b.status}
          paymentStatus={b.paymentStatus}
          paymentFailureReason={b.paymentFailureReason}
          deferredAssignmentMessage={b.deferredAssignmentMessage}
        />

        {b.status === "payment_failed" ? (
          <PaymentIssuePanel
            bookingId={b.id}
            customerEmail={customerEmail}
            paymentFailureReason={b.paymentFailureReason}
            canRetryPayment={b.canRetryPayment}
          />
        ) : (
          <CustomerBookingWhatHappensNext status={b.status} />
        )}

        <CustomerBookingDetailsCard
          serviceLabel={b.display.serviceLabel}
          homeSizeSummary={b.display.homeSizeSummary}
          cleaningIntensityLabel={b.display.cleaningIntensityLabel}
          equipmentSupplyLabel={b.display.equipmentSupplyLabel}
          frequencyLabel={b.display.frequencyLabel}
          addonsSummary={b.display.addonsSummary}
          teamSupportLabel={b.display.teamSupportLabel}
          cleanerPreferenceLabel={b.cleanerPreferenceLabel}
          assignedCleanerLabel={b.assignedCleanerLabel}
          assignmentCustomerMessage={b.display.assignmentCustomerMessage}
          specialInstructions={b.display.specialInstructions}
          contactPhoneDisplay={b.display.contactPhoneDisplay}
          priceCents={b.priceCents}
          currency={b.currency}
          payments={b.payments}
        />

        <section className={`${CUSTOMER_BOOKING_DETAIL_CARD_CLASS} p-4 sm:p-5`}>
          <h2 className="text-sm font-medium text-zinc-800">Activity</h2>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
            Progress from payment through completion.
          </p>
          <section className="mt-3">
            <CustomerLifecycleTimeline events={b.timeline} />
          </section>
        </section>
      </section>
    </DashboardShell>
  );
}
