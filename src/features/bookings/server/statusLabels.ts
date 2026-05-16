import type { AssignmentOfferStatus, PaymentStatus } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";

export type StatusBadgeTone = "neutral" | "info" | "success" | "warning" | "danger";

export function labelForBookingStatus(status: BookingStatus): string {
  const labels: Record<BookingStatus, string> = {
    draft: "Draft",
    pending_payment: "Awaiting payment",
    confirmed: "Payment confirmed",
    pending_assignment: "Finding cleaner",
    assigned: "Cleaner assigned",
    in_progress: "In progress",
    completed: "Completed",
    payout_ready: "Payout ready",
    paid_out: "Paid out",
    cancelled: "Cancelled",
    payment_failed: "Payment failed",
  };
  return labels[status];
}

export function toneForBookingStatus(status: BookingStatus): StatusBadgeTone {
  switch (status) {
    case "completed":
    case "paid_out":
      return "success";
    case "payout_ready":
      return "info";
    case "cancelled":
    case "payment_failed":
      return "danger";
    case "pending_payment":
    case "pending_assignment":
      return "warning";
    case "assigned":
    case "in_progress":
    case "confirmed":
      return "info";
    default:
      return "neutral";
  }
}

export function labelForPaymentStatus(status: PaymentStatus | null): string {
  if (!status) return "No payment";
  const labels: Record<PaymentStatus, string> = {
    initialized: "Initialized",
    pending: "Pending",
    paid: "Paid",
    failed: "Failed",
    refunded: "Refunded",
  };
  return labels[status];
}

export function toneForPaymentStatus(status: PaymentStatus | null): StatusBadgeTone {
  if (!status) return "neutral";
  switch (status) {
    case "paid":
      return "success";
    case "failed":
    case "refunded":
      return "danger";
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}

export function labelForOfferStatus(status: AssignmentOfferStatus): string {
  const labels: Record<AssignmentOfferStatus, string> = {
    offered: "Offered",
    accepted: "Accepted",
    declined: "Declined",
    expired: "Expired",
    cancelled: "Cancelled",
  };
  return labels[status];
}

export function toneForOfferStatus(status: AssignmentOfferStatus): StatusBadgeTone {
  switch (status) {
    case "accepted":
      return "success";
    case "declined":
    case "expired":
    case "cancelled":
      return "danger";
    case "offered":
      return "warning";
    default:
      return "neutral";
  }
}

export function labelForPayoutStatus(
  status: import("@/lib/database/types").EarningPayoutStatus,
): string {
  const labels = {
    pending: "Pending payout",
    payout_ready: "Ready for payout",
    paid: "Paid",
  } as const;
  return labels[status];
}

export function toneForPayoutStatus(
  status: import("@/lib/database/types").EarningPayoutStatus,
): StatusBadgeTone {
  switch (status) {
    case "paid":
      return "success";
    case "payout_ready":
      return "info";
    case "pending":
      return "warning";
    default:
      return "neutral";
  }
}

export function labelForAssignmentAttention(
  status: string | null | undefined,
): string {
  if (status === "attention_required") return "Needs assignment";
  if (status === "offered") return "Offer sent";
  return status ? String(status) : "—";
}
