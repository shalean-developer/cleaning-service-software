import type { SupportSlaStatus } from "./supportRequestSla";

export type SupportEscalationInput = {
  id: string;
  source: "booking_support" | "recurring_support";
  status: string;
  requestType: string;
  createdAt: string;
  updatedAt: string;
  bookingId: string | null;
  seriesId: string | null;
  customerId: string;
  slaStatus: SupportSlaStatus;
  ageMinutes: number;
  upcomingVisitHours: number | null;
};

export type SupportEscalationContext = {
  bookingRequestCounts: Map<string, number>;
  customerCleanerIssueCounts: Map<string, number>;
  customerPaymentHelpCounts: Map<string, number>;
  recurringUnresolvedBeforeVisit: Set<string>;
};

export function buildSupportEscalationContext(
  items: SupportEscalationInput[],
): SupportEscalationContext {
  const bookingRequestCounts = new Map<string, number>();
  const customerCleanerIssueCounts = new Map<string, number>();
  const customerPaymentHelpCounts = new Map<string, number>();
  const recurringUnresolvedBeforeVisit = new Set<string>();

  for (const item of items) {
    if (item.bookingId) {
      bookingRequestCounts.set(item.bookingId, (bookingRequestCounts.get(item.bookingId) ?? 0) + 1);
    }
    if (item.requestType === "cleaner_issue") {
      customerCleanerIssueCounts.set(
        item.customerId,
        (customerCleanerIssueCounts.get(item.customerId) ?? 0) + 1,
      );
    }
    if (item.requestType === "payment_help") {
      customerPaymentHelpCounts.set(
        item.customerId,
        (customerPaymentHelpCounts.get(item.customerId) ?? 0) + 1,
      );
    }
    if (
      item.source === "recurring_support" &&
      (item.status === "open" || item.status === "acknowledged") &&
      item.upcomingVisitHours != null &&
      item.upcomingVisitHours > 0 &&
      item.upcomingVisitHours <= 48
    ) {
      recurringUnresolvedBeforeVisit.add(item.id);
    }
  }

  return {
    bookingRequestCounts,
    customerCleanerIssueCounts,
    customerPaymentHelpCounts,
    recurringUnresolvedBeforeVisit,
  };
}

/** Admin-only escalation reasons. no customer notifications. */
export function detectSupportEscalations(
  item: SupportEscalationInput,
  context: SupportEscalationContext,
): string[] {
  const reasons: string[] = [];
  const isOpen = item.status === "open" || item.status === "acknowledged";

  if (!isOpen) return reasons;

  if (item.status === "open" && item.requestType !== "general_message") {
    const urgentTypes = ["payment_help", "cleaner_issue", "service_issue"];
    if (urgentTypes.includes(item.requestType) && item.ageMinutes >= 60) {
      reasons.push("Urgent request open more than 1 hour");
    }
  }

  if (item.status === "acknowledged" && item.ageMinutes >= 24 * 60) {
    reasons.push("Acknowledged more than 24 hours without resolution");
  }

  if (item.slaStatus === "breached") {
    reasons.push("SLA breached");
  }

  if (item.bookingId && (context.bookingRequestCounts.get(item.bookingId) ?? 0) >= 2) {
    reasons.push("Multiple requests on same booking");
  }

  if ((context.customerCleanerIssueCounts.get(item.customerId) ?? 0) >= 2) {
    reasons.push("Repeated cleaner issues for customer");
  }

  if ((context.customerPaymentHelpCounts.get(item.customerId) ?? 0) >= 2) {
    reasons.push("Repeated payment help requests");
  }

  if (context.recurringUnresolvedBeforeVisit.has(item.id)) {
    reasons.push("Recurring request unresolved before next visit window");
  }

  return reasons;
}
