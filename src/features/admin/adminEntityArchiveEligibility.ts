import type { BookingStatus } from "@/features/bookings/server/types";
import type { PaymentStatus } from "@/lib/database/types";

export const BOOKING_HARD_DELETE_CONFIRM_PHRASE = "PERMANENTLY DELETE BOOKING";

export const ARCHIVE_CUSTOMER_CONFIRM_PHRASE = "ARCHIVE CUSTOMER";
export const CUSTOMER_HARD_DELETE_CONFIRM_PHRASE = "PERMANENTLY DELETE CUSTOMER";

export type BookingArchiveEligibilityInput = {
  deletedAt: string | null;
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  hasEarningLines: boolean;
};

export type BookingArchiveEligibility = {
  isArchived: boolean;
  canArchive: boolean;
  deleteBlockedMessage: string | null;
};

const COMPLETED_STATUSES = ["completed", "payout_ready", "paid_out"] as const;
const ACTIVE_ASSIGNMENT_STATUSES = ["assigned", "in_progress"] as const;

export function assessBookingArchiveEligibility(
  input: BookingArchiveEligibilityInput,
): BookingArchiveEligibility {
  const isArchived = input.deletedAt != null;
  const hasPaid = input.paymentStatus === "paid";
  const isCompleted = (COMPLETED_STATUSES as readonly string[]).includes(input.status);
  const hasActiveAssignment = (ACTIVE_ASSIGNMENT_STATUSES as readonly string[]).includes(
    input.status,
  );
  const hasFinancialHistory = hasPaid || input.hasEarningLines || isCompleted;

  let deleteBlockedMessage: string | null = null;
  if (hasActiveAssignment) {
    deleteBlockedMessage =
      "This booking cannot be archived while it is assigned or in progress.";
  } else if (hasFinancialHistory) {
    deleteBlockedMessage =
      "This booking has payment or payout history. Archive it instead of deleting.";
  }

  return {
    isArchived,
    canArchive: !isArchived && !hasActiveAssignment,
    deleteBlockedMessage,
  };
}

export type CustomerArchiveEligibilityInput = {
  deletedAt: string | null;
  bookingCount: number;
  paidPaymentCount: number;
};

export type CustomerArchiveEligibility = {
  isArchived: boolean;
  canHardDelete: boolean;
  canArchive: boolean;
  hardDeleteBlockedMessage: string | null;
};

export function assessCustomerArchiveEligibility(
  input: CustomerArchiveEligibilityInput,
): CustomerArchiveEligibility {
  const isArchived = input.deletedAt != null;
  const hasHistory = input.bookingCount > 0 || input.paidPaymentCount > 0;

  return {
    isArchived,
    canHardDelete: !hasHistory,
    canArchive: !isArchived,
    hardDeleteBlockedMessage: hasHistory
      ? "Customers with booking or payment history cannot be permanently deleted. Archive preserves all history."
      : null,
  };
}
