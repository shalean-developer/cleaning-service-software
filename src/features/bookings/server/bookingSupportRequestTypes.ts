import type { BookingStatus } from "@/features/bookings/server/types";
import type { PaymentStatus } from "@/lib/database/types";
import type {
  BookingSupportRequestStatus,
  BookingSupportRequestType,
} from "@/lib/database/types";
import { isUpcomingCustomerBooking } from "@/features/bookings/server/paymentFailureDisplay";

export type BookingSupportQueryParam =
  | "reschedule"
  | "cancel"
  | "payment_help"
  | "service_issue"
  | "cleaner_issue"
  | "message";

const QUERY_TO_REQUEST_TYPE: Record<BookingSupportQueryParam, BookingSupportRequestType> = {
  reschedule: "reschedule",
  cancel: "cancel",
  payment_help: "payment_help",
  service_issue: "service_issue",
  cleaner_issue: "cleaner_issue",
  message: "general_message",
};

export function parseBookingSupportQueryParam(
  value: string | undefined | null,
): BookingSupportQueryParam | null {
  if (!value?.trim()) return null;
  const key = value.trim() as BookingSupportQueryParam;
  return key in QUERY_TO_REQUEST_TYPE ? key : null;
}

export function requestTypeFromSupportQuery(
  query: BookingSupportQueryParam,
): BookingSupportRequestType {
  return QUERY_TO_REQUEST_TYPE[query];
}

export type BookingSupportActionContext = {
  status: BookingStatus;
  paymentStatus: PaymentStatus | null;
  isSeriesVisit: boolean;
  hasAssignedCleaner: boolean;
};

export type BookingSupportActionId = BookingSupportRequestType;

export type BookingSupportActionOption = {
  id: BookingSupportActionId;
  label: string;
  description: string;
};

const REQUEST_TYPE_LABELS: Record<BookingSupportRequestType, string> = {
  reschedule: "Request reschedule",
  cancel: "Request cancellation",
  payment_help: "Get payment help",
  cleaner_issue: "Report cleaner issue",
  service_issue: "Report service issue",
  general_message: "Message support",
};

const REQUEST_STATUS_LABELS: Record<BookingSupportRequestStatus, string> = {
  open: "Open",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  rejected: "Rejected",
};

export function labelForBookingSupportRequestType(type: BookingSupportRequestType): string {
  return REQUEST_TYPE_LABELS[type];
}

export function labelForBookingSupportRequestStatus(status: BookingSupportRequestStatus): string {
  return REQUEST_STATUS_LABELS[status];
}

export const BOOKING_SUPPORT_COPY = {
  rescheduleDescription:
    "Request a new time. Our team will confirm availability before updating your booking.",
  cancelDescription:
    "Request cancellation. Our team will review timing, cleaner status, and payment rules before confirming.",
  serviceIssueDescription: "Tell us what happened so our support team can help.",
  paymentHelpDescription: "We'll help you resolve payment or checkout issues.",
  generalMessageDescription: "Send a message to our support team about this booking.",
  cleanerIssueDescription: "Tell us about a concern with your assigned cleaner.",
  panelIntro:
    "Submit a request for our team to review. We do not change your booking automatically.",
  recurringRedirectNote:
    "This visit is part of a recurring schedule. Use Recurring in your dashboard to pause, cancel, or reschedule your full schedule.",
} as const;

function showsPaymentHelp(ctx: BookingSupportActionContext): boolean {
  if (ctx.status === "payment_failed") return true;
  if (!ctx.paymentStatus) return false;
  return (
    ctx.paymentStatus === "initialized" ||
    ctx.paymentStatus === "pending" ||
    ctx.paymentStatus === "failed"
  );
}

function canRescheduleOrCancel(ctx: BookingSupportActionContext): boolean {
  if (ctx.isSeriesVisit) return false;
  if (ctx.status === "cancelled") return false;
  if (ctx.status === "payout_ready" || ctx.status === "paid_out") return false;
  return isUpcomingCustomerBooking(ctx.status);
}

function canReportServiceIssue(ctx: BookingSupportActionContext): boolean {
  return (
    ctx.status === "in_progress" ||
    ctx.status === "payout_ready" ||
    ctx.status === "paid_out"
  );
}

export function listAvailableBookingSupportActions(
  ctx: BookingSupportActionContext,
): BookingSupportActionOption[] {
  const actions: BookingSupportActionOption[] = [];

  if (canRescheduleOrCancel(ctx)) {
    actions.push({
      id: "reschedule",
      label: REQUEST_TYPE_LABELS.reschedule,
      description: BOOKING_SUPPORT_COPY.rescheduleDescription,
    });
    actions.push({
      id: "cancel",
      label: REQUEST_TYPE_LABELS.cancel,
      description: BOOKING_SUPPORT_COPY.cancelDescription,
    });
  }

  if (showsPaymentHelp(ctx)) {
    actions.push({
      id: "payment_help",
      label: REQUEST_TYPE_LABELS.payment_help,
      description: BOOKING_SUPPORT_COPY.paymentHelpDescription,
    });
  }

  if (canReportServiceIssue(ctx)) {
    actions.push({
      id: "service_issue",
      label: REQUEST_TYPE_LABELS.service_issue,
      description: BOOKING_SUPPORT_COPY.serviceIssueDescription,
    });
  }

  if (ctx.hasAssignedCleaner) {
    actions.push({
      id: "cleaner_issue",
      label: REQUEST_TYPE_LABELS.cleaner_issue,
      description: BOOKING_SUPPORT_COPY.cleanerIssueDescription,
    });
  }

  actions.push({
    id: "general_message",
    label: REQUEST_TYPE_LABELS.general_message,
    description: BOOKING_SUPPORT_COPY.generalMessageDescription,
  });

  return actions;
}

export function isBookingSupportRequestTypeAllowed(
  ctx: BookingSupportActionContext,
  requestType: BookingSupportRequestType,
): boolean {
  return listAvailableBookingSupportActions(ctx).some((a) => a.id === requestType);
}

export function customerBookingSupportHref(
  bookingId: string,
  support: BookingSupportQueryParam,
): string {
  return `/customer/bookings/${bookingId}?support=${support}`;
}

export function customerHubSupportQuickLinks(featured: {
  id: string;
  isSeriesVisit: boolean;
  seriesId: string | null;
}) {
  const base = `/customer/bookings/${featured.id}`;
  if (featured.isSeriesVisit) {
    const recurringHref = featured.seriesId
      ? `/customer/bookings/recurring/${featured.seriesId}`
      : "/customer/bookings/recurring";
    return {
      reschedule: recurringHref,
      cancel: recurringHref,
      message: `${base}?support=message`,
    };
  }
  return {
    reschedule: `${base}?support=reschedule`,
    cancel: `${base}?support=cancel`,
    message: `${base}?support=message`,
  };
}
