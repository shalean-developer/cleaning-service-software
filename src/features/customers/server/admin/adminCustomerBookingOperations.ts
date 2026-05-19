import type { PaymentStatus } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import type {
  AdminCustomerBookingHistoryItem,
  AdminCustomerBookingOperationsSummary,
  AdminCustomerDetail,
  AdminCustomerPaymentSupportSummary,
} from "./types";
import type { AdminCustomerDetailBookingFilter } from "./parseAdminCustomerDetailQuery";

const TERMINAL_STATUSES = new Set<BookingStatus>([
  "completed",
  "payout_ready",
  "paid_out",
  "cancelled",
]);

const ACTIVE_STATUSES = new Set<BookingStatus>([
  "pending_payment",
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
]);

const COMPLETED_STATUSES = new Set<BookingStatus>([
  "completed",
  "payout_ready",
  "paid_out",
]);

function isPendingPaymentBooking(booking: AdminCustomerBookingHistoryItem): boolean {
  if (booking.status === "pending_payment") return true;
  return (
    booking.paymentStatus === "pending" || booking.paymentStatus === "initialized"
  );
}

function isFailedPaymentBooking(booking: AdminCustomerBookingHistoryItem): boolean {
  if (booking.status === "payment_failed") return true;
  return booking.paymentStatus === "failed";
}

export function isUpcomingBooking(
  booking: AdminCustomerBookingHistoryItem,
  nowMs: number = Date.now(),
): boolean {
  if (TERMINAL_STATUSES.has(booking.status as BookingStatus)) return false;
  if (booking.status === "draft" || booking.status === "payment_failed") return false;
  return new Date(booking.scheduledStart).getTime() > nowMs;
}

export function isActiveBooking(booking: AdminCustomerBookingHistoryItem): boolean {
  return ACTIVE_STATUSES.has(booking.status as BookingStatus);
}

export function matchesAdminCustomerBookingFilter(
  booking: AdminCustomerBookingHistoryItem,
  filter: AdminCustomerDetailBookingFilter,
  nowMs: number = Date.now(),
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "upcoming":
      return isUpcomingBooking(booking, nowMs);
    case "pending_payment":
      return isPendingPaymentBooking(booking);
    case "failed_payment":
      return isFailedPaymentBooking(booking);
    case "completed":
      return COMPLETED_STATUSES.has(booking.status as BookingStatus);
    case "cancelled":
      return booking.status === "cancelled";
    default:
      return true;
  }
}

export function filterAdminCustomerBookings(
  bookings: AdminCustomerBookingHistoryItem[],
  filter: AdminCustomerDetailBookingFilter,
): AdminCustomerBookingHistoryItem[] {
  return bookings.filter((b) => matchesAdminCustomerBookingFilter(b, filter));
}

export function buildAdminCustomerBookingOperationsSummary(
  bookings: AdminCustomerBookingHistoryItem[],
  nowMs: number = Date.now(),
): AdminCustomerBookingOperationsSummary {
  let activeCount = 0;
  let upcomingCount = 0;
  let pendingPaymentCount = 0;
  let failedPaymentCount = 0;
  let completedCount = 0;

  for (const booking of bookings) {
    if (isActiveBooking(booking)) activeCount += 1;
    if (isUpcomingBooking(booking, nowMs)) upcomingCount += 1;
    if (isPendingPaymentBooking(booking)) pendingPaymentCount += 1;
    if (isFailedPaymentBooking(booking)) failedPaymentCount += 1;
    if (COMPLETED_STATUSES.has(booking.status as BookingStatus)) completedCount += 1;
  }

  const sortedByCreated = [...bookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latestBooking = sortedByCreated[0] ?? null;

  const upcomingSorted = bookings
    .filter((b) => isUpcomingBooking(b, nowMs))
    .sort(
      (a, b) =>
        new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime(),
    );
  const nextScheduledBooking = upcomingSorted[0] ?? null;

  return {
    activeCount,
    upcomingCount,
    pendingPaymentCount,
    failedPaymentCount,
    completedCount,
    latestBookingId: latestBooking?.id ?? null,
    nextScheduledBookingId: nextScheduledBooking?.id ?? null,
  };
}

export function buildAdminCustomerPaymentSupportSummary(
  detail: Pick<AdminCustomerDetail, "paymentSummary" | "payments">,
): AdminCustomerPaymentSupportSummary {
  const { paymentSummary, payments } = detail;
  const latestPayment = payments[0] ?? null;

  let latestPaymentMethod: string | null = null;
  if (latestPayment) {
    latestPaymentMethod = latestPayment.provider;
    const meta = latestPayment.metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const channel = (meta as Record<string, unknown>).channel;
      if (typeof channel === "string" && channel.trim()) {
        latestPaymentMethod = channel.trim();
      }
    }
  }

  return {
    totalPaidCents: paymentSummary.totalPaidCents,
    pendingPaymentCount: paymentSummary.pendingCount,
    failedPaymentCount: paymentSummary.failedCount,
    latestPaymentAttemptAt: latestPayment?.createdAt ?? null,
    latestPaymentMethod,
    latestPaymentBookingId: latestPayment?.bookingId ?? null,
    latestPaymentStatus: (latestPayment?.status as PaymentStatus | undefined) ?? null,
  };
}

export function adminCustomerBookingFilterEmptyMessage(
  filter: AdminCustomerDetailBookingFilter,
): string {
  switch (filter) {
    case "upcoming":
      return "No upcoming bookings for this customer.";
    case "pending_payment":
      return "No bookings awaiting payment.";
    case "failed_payment":
      return "No bookings with failed payment.";
    case "completed":
      return "No completed bookings yet.";
    case "cancelled":
      return "No cancelled bookings.";
    case "all":
    default:
      return "No bookings yet.";
  }
}

export const ADMIN_CUSTOMER_BOOKING_FILTER_OPTIONS: {
  value: AdminCustomerDetailBookingFilter;
  label: string;
}[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "pending_payment", label: "Pending payment" },
  { value: "failed_payment", label: "Failed payment" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];
