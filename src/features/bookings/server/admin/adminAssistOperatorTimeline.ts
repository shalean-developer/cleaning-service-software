import type { AdminAssistTimelineEntry } from "./buildAdminBookingAssistTimeline";

export type AdminAssistTimelineGroupId =
  | "draft"
  | "payment"
  | "notification"
  | "offline"
  | "recurring"
  | "assignment"
  | "recovery";

export type AdminAssistTimelineGroup = {
  id: AdminAssistTimelineGroupId;
  label: string;
  entries: AdminAssistTimelineEntry[];
};

export type AdminAssistNextRecommendedAction = {
  label: string;
  reason: string;
};

const GROUP_LABELS: Record<AdminAssistTimelineGroupId, string> = {
  draft: "Draft lifecycle",
  payment: "Payment lifecycle",
  notification: "Notification lifecycle",
  offline: "Offline payment lifecycle",
  recurring: "Recurring lifecycle",
  assignment: "Assignment milestones",
  recovery: "Recovery actions",
};

function groupForKind(kind: AdminAssistTimelineEntry["kind"]): AdminAssistTimelineGroupId {
  switch (kind) {
    case "draft_created":
    case "pending_payment":
      return "draft";
    case "payment_link_generated":
    case "payment_link_regenerated":
    case "payment_link_expired":
    case "payment_confirmed":
      return "payment";
    case "payment_request_copied":
    case "payment_request_sent":
      return "notification";
    case "offline_payment_recorded":
    case "sop_confirmed":
      return "offline";
    case "recurring_materialized":
      return "recurring";
    case "assignment_started":
    case "assignment_escalation":
      return "assignment";
    case "recovery_action":
      return "recovery";
    default:
      return "payment";
  }
}

export function formatAdminAssistRelativeTimestamp(at: string, nowMs = Date.now()): string {
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) return at;
  const diffSec = Math.round((nowMs - ms) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 48) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

export function groupAdminAssistTimelineEntries(
  entries: AdminAssistTimelineEntry[],
): AdminAssistTimelineGroup[] {
  const buckets = new Map<AdminAssistTimelineGroupId, AdminAssistTimelineEntry[]>();
  for (const entry of entries) {
    const groupId = groupForKind(entry.kind);
    const list = buckets.get(groupId) ?? [];
    list.push(entry);
    buckets.set(groupId, list);
  }

  const order: AdminAssistTimelineGroupId[] = [
    "draft",
    "payment",
    "notification",
    "offline",
    "recurring",
    "assignment",
    "recovery",
  ];
  return order
    .filter((id) => (buckets.get(id)?.length ?? 0) > 0)
    .map((id) => ({
      id,
      label: GROUP_LABELS[id],
      entries: buckets.get(id) ?? [],
    }));
}

export function resolveAdminAssistNextRecommendedAction(input: {
  bookingStatus: string;
  paymentLinkExpired: boolean;
  hasPaymentLink: boolean;
  customerHasEmail: boolean;
  emailFailed: boolean;
  bookingConfirmed: boolean;
}): AdminAssistNextRecommendedAction | null {
  if (input.bookingConfirmed) {
    return {
      label: "Monitor assignment",
      reason: "Payment is confirmed — assignment proceeds via the normal post-payment flow.",
    };
  }
  if (input.paymentLinkExpired) {
    return {
      label: "Regenerate payment link",
      reason: "The active Paystack link has expired.",
    };
  }
  if (input.emailFailed && input.customerHasEmail) {
    return {
      label: "Resend payment request email",
      reason: "The last email notification failed delivery.",
    };
  }
  if (!input.customerHasEmail && input.hasPaymentLink) {
    return {
      label: "Copy WhatsApp message",
      reason: "Customer has no email on file — use WhatsApp copy for payment request.",
    };
  }
  if (input.bookingStatus === "draft") {
    return {
      label: "Create pending payment booking",
      reason: "Draft is saved — move to pending payment before sharing a link.",
    };
  }
  if (input.bookingStatus === "pending_payment" && !input.hasPaymentLink) {
    return {
      label: "Generate payment link",
      reason: "Booking is awaiting payment but no active link exists.",
    };
  }
  if (input.bookingStatus === "pending_payment" && input.hasPaymentLink) {
    return {
      label: "Wait for customer payment",
      reason: "Share the link if needed, then wait for Paystack confirmation.",
    };
  }
  return null;
}
