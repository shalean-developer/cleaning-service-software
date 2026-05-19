import type { PaymentStatus } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  labelForCustomerBookingStatus,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import { labelForBookingStatus, labelForPaymentStatus } from "@/features/bookings/server/statusLabels";
import type { LifecycleAudience } from "./lifecycleTimeline";

/** Human payment milestone titles for customer/cleaner timelines (no raw command strings). */
export function humanPaymentEventTitle(
  status: PaymentStatus,
  audience: LifecycleAudience,
): string {
  if (audience === "admin") {
    return `Payment ${labelForPaymentStatus(status).toLowerCase()}`;
  }
  switch (status) {
    case "paid":
      return "Payment confirmed";
    case "failed":
      return "Payment not completed";
    case "pending":
      return "Payment pending";
    case "refunded":
      return "Payment refunded";
    case "initialized":
      return "Payment started";
    default:
      return labelForPaymentStatus(status);
  }
}

/** Booking status label for lifecycle audit/current rows by audience. */
export function humanAuditStatusTitle(
  toStatus: BookingStatus,
  audience: LifecycleAudience,
  paymentFailureReason?: PaymentFailureReason,
): string {
  if (audience === "customer") {
    return labelForCustomerBookingStatus(toStatus, paymentFailureReason);
  }
  return labelForBookingStatus(toStatus);
}

/**
 * Optional human title from audit command when it is clearer than `to_status` alone.
 * Never returns raw command identifiers for customer/cleaner audiences.
 */
export function humanAuditCommandTitle(
  command: string | null,
  toStatus: BookingStatus | null,
  audience: LifecycleAudience,
  paymentFailureReason?: PaymentFailureReason,
): string | null {
  if (!command || audience === "admin") return null;

  switch (command) {
    case "MARK_PAYMENT_FAILED":
      return labelForCustomerBookingStatus("payment_failed", paymentFailureReason);
    case "CONFIRM_PAYMENT":
      return "Payment confirmed";
    case "MARK_PAYMENT_PENDING":
      return "Awaiting payment";
    case "MARK_IN_PROGRESS":
      return "Cleaning in progress";
    case "MARK_COMPLETED":
      return "Booking completed";
    case "RECORD_ASSIGNMENT_OFFER_EXPIRED":
      return "Offer expired";
    default:
      break;
  }

  if (toStatus) return humanAuditStatusTitle(toStatus, audience, paymentFailureReason);
  return null;
}

export function auditEventDetail(
  command: string | null,
  audience: LifecycleAudience,
): string | null {
  if (audience === "admin") return command ?? null;
  return null;
}
