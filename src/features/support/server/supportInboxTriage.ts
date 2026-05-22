import type { BookingSupportRequestType } from "@/lib/database/types";
import type { RecurringSeriesRequestType } from "@/lib/database/types";

export const SUPPORT_INBOX_TRIAGE_NOTICE =
  "This inbox tracks customer requests. Updating request status does not automatically change bookings, payments, or cleaner assignments." as const;

const BOOKING_NEXT_ACTION: Record<BookingSupportRequestType, string> = {
  reschedule: "Open the booking and use the existing admin reschedule or change flow.",
  cancel: "Review payment and cleaner status before cancelling the booking.",
  payment_help: "Open the booking payment panel and assist with payment or retry.",
  cleaner_issue: "Contact the assigned cleaner and customer; document outcome before resolving.",
  service_issue: "Investigate the visit details before marking resolved.",
  general_message: "Reply to the customer as needed, then update request status.",
};

const RECURRING_TYPE_PATTERN = /cancel|reschedule|pause/i;

export function suggestedNextActionForBookingRequest(
  requestType: BookingSupportRequestType,
): string {
  return BOOKING_NEXT_ACTION[requestType];
}

export function suggestedNextActionForRecurringRequest(
  requestType: RecurringSeriesRequestType,
): string {
  if (RECURRING_TYPE_PATTERN.test(requestType)) {
    return "Open the recurring series or schedule group and apply pause, cancel, or reschedule manually.";
  }
  return "Open the recurring series or schedule group to review the request.";
}
