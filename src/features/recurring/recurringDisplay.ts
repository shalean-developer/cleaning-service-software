import type { BookingSeriesStatus, RecurringSeriesFrequency } from "./types";

export function recurringFrequencyLabel(frequency: RecurringSeriesFrequency): string {
  switch (frequency) {
    case "weekly":
      return "Weekly";
    case "biweekly":
      return "Bi-weekly";
    case "monthly":
      return "Monthly";
    default:
      return frequency;
  }
}

export function recurringSeriesStatusLabel(status: BookingSeriesStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function recurringPaymentRequiredLabel(required: boolean): string {
  return required ? "Payment required" : "Paid / scheduled";
}
