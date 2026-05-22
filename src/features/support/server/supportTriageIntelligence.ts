import type { SupportSlaStatus } from "./supportRequestSla";

export type SupportTriageLabel =
  | "needs_action_today"
  | "upcoming_booking_at_risk"
  | "awaiting_customer"
  | "awaiting_ops_action";

export function supportTriageLabel(input: {
  status: string;
  slaStatus: SupportSlaStatus;
  paymentRisk: boolean;
  upcomingVisitHours: number | null;
  customerResponse: string | null;
  respondedAt: string | null;
}): SupportTriageLabel | null {
  if (input.status === "resolved" || input.status === "rejected") {
    return input.customerResponse && !input.respondedAt ? "awaiting_customer" : null;
  }

  if (input.status === "open" || input.status === "acknowledged") {
    if (input.slaStatus === "breached" || input.slaStatus === "warning") {
      return "needs_action_today";
    }
    if (
      input.upcomingVisitHours != null &&
      input.upcomingVisitHours > 0 &&
      input.upcomingVisitHours <= 24
    ) {
      return "upcoming_booking_at_risk";
    }
    if (input.paymentRisk) {
      return "needs_action_today";
    }
    return "awaiting_ops_action";
  }

  return null;
}

export function supportPaymentRisk(paymentStatus: string | null): boolean {
  if (!paymentStatus) return false;
  return paymentStatus === "failed" || paymentStatus === "pending";
}

export function upcomingVisitHoursFromScheduledStart(
  scheduledStart: string | null,
  now: Date = new Date(),
): number | null {
  if (!scheduledStart) return null;
  const ms = new Date(scheduledStart).getTime() - now.getTime();
  if (ms <= 0) return null;
  return ms / (60 * 60 * 1000);
}
