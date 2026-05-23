import type { BookingStatus } from "@/features/bookings/server/types";
import type { AdminAssistPaymentLinkMetadata } from "./adminAssistPaymentLinkMetadata";
import {
  isAdminAssistPaymentLinkActive,
  isAdminAssistPaymentLinkExpired,
} from "./adminAssistPaymentLinkMetadata";
import type { AdminBookingAssistAuditRow } from "./loadAdminBookingAssistAudits";

export type AdminAssistTimelineEntryKind =
  | "draft_created"
  | "pending_payment"
  | "payment_link_generated"
  | "payment_link_regenerated"
  | "payment_link_expired"
  | "payment_request_copied"
  | "payment_request_sent"
  | "offline_payment_recorded"
  | "sop_confirmed"
  | "payment_confirmed"
  | "recurring_materialized"
  | "assignment_started"
  | "assignment_escalation"
  | "recovery_action";

export type AdminAssistTimelineEntrySeverity = "info" | "warning" | "high" | "critical";

export type AdminAssistTimelineEntry = {
  id: string;
  at: string;
  kind: AdminAssistTimelineEntryKind;
  title: string;
  description: string | null;
  reference: string | null;
  deliveryChannel: string | null;
  adminProfileId: string | null;
  previousReference: string | null;
  severity?: AdminAssistTimelineEntrySeverity;
  milestone?: boolean;
};

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapAuditToTimelineEntry(
  row: AdminBookingAssistAuditRow,
): AdminAssistTimelineEntry | AdminAssistTimelineEntry[] | null {
  const payload =
    row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? (row.payload as Record<string, unknown>)
      : {};

  switch (row.action) {
    case "admin_booking_draft_created":
      return {
        id: row.id,
        at: row.createdAt,
        kind: "draft_created",
        title: "Admin draft created",
        description: "Booking saved as admin-assisted draft.",
        reference: null,
        deliveryChannel: null,
        adminProfileId: row.adminProfileId,
        previousReference: null,
      };
    case "admin_booking_pending_payment_created":
      return {
        id: row.id,
        at: row.createdAt,
        kind: "pending_payment",
        title: "Moved to pending payment",
        description: "Awaiting customer payment before assignment.",
        reference: null,
        deliveryChannel: null,
        adminProfileId: row.adminProfileId,
        previousReference: null,
      };
    case "admin_booking_payment_link_generated":
      return {
        id: row.id,
        at: row.createdAt,
        kind: "payment_link_generated",
        title: "Payment link generated",
        description: "Paystack checkout link created for customer.",
        reference: payloadString(payload, "reference"),
        deliveryChannel: payloadString(payload, "deliveryChannel"),
        adminProfileId: row.adminProfileId,
        previousReference: null,
      };
    case "admin_booking_payment_link_regenerated":
      return {
        id: row.id,
        at: row.createdAt,
        kind: "payment_link_regenerated",
        title: "Payment link regenerated",
        description: "Previous link superseded; new Paystack link issued.",
        reference: payloadString(payload, "reference"),
        deliveryChannel: payloadString(payload, "deliveryChannel"),
        adminProfileId: row.adminProfileId,
        previousReference: payloadString(payload, "previousReference"),
        severity: "warning",
        milestone: true,
      };
    case "admin_booking_payment_link_expired":
      return {
        id: row.id,
        at: row.createdAt,
        kind: "payment_link_expired",
        title: "Payment link expired",
        description: "Checkout link passed its expiry time.",
        reference: payloadString(payload, "reference"),
        deliveryChannel: null,
        adminProfileId: row.adminProfileId,
        previousReference: null,
      };
    case "admin_booking_payment_request_copied":
      return {
        id: row.id,
        at: row.createdAt,
        kind: "payment_request_copied",
        title: "Payment link copied",
        description: "Admin copied the payment URL to share with the customer.",
        reference: payloadString(payload, "reference"),
        deliveryChannel: payloadString(payload, "deliveryChannel"),
        adminProfileId: row.adminProfileId,
        previousReference: null,
      };
    case "admin_booking_payment_request_sent": {
      const channel = payloadString(payload, "deliveryChannel");
      const notificationStatus = payloadString(payload, "notificationStatus");
      const idempotentReplay = payload.idempotentReplay === true;
      const title =
        notificationStatus === "copied"
          ? "WhatsApp message prepared"
          : idempotentReplay
            ? "Payment request resend replayed"
            : notificationStatus === "queued"
              ? "Payment request email queued"
              : "Payment request sent";
      const description =
        notificationStatus === "copied"
          ? "WhatsApp-ready copy generated for manual send."
          : notificationStatus === "queued"
            ? "Email queued for delivery to the customer."
            : "Payment request notification recorded.";
      return {
        id: row.id,
        at: row.createdAt,
        kind: idempotentReplay ? "recovery_action" : "payment_request_sent",
        title,
        description,
        reference: payloadString(payload, "reference"),
        deliveryChannel: channel,
        adminProfileId: row.adminProfileId,
        previousReference: null,
        severity: idempotentReplay ? "info" : notificationStatus === "failed" ? "high" : "info",
        milestone: !idempotentReplay,
      };
    }
    case "admin_booking_offline_payment_recorded": {
      const rail = payloadString(payload, "rail");
      const sopConfirmed = payload.sopConfirmed === true;
      const entries: AdminAssistTimelineEntry[] = [];
      if (sopConfirmed) {
        entries.push({
          id: `${row.id}-sop`,
          at: row.createdAt,
          kind: "sop_confirmed",
          title: "SOP reconciliation confirmed",
          description: "Operator verified payment against bank/cash/terminal records.",
          reference: payloadString(payload, "evidenceReference"),
          deliveryChannel: rail,
          adminProfileId: row.adminProfileId,
          previousReference: null,
          severity: "info",
          milestone: true,
        });
      }
      entries.push({
        id: row.id,
        at: row.createdAt,
        kind: "offline_payment_recorded",
        title: "Offline payment recorded",
        description: rail
          ? `${rail.replace(/_/g, " ")} payment recorded and booking finalized. Assignment proceeds via normal post-payment flow.`
          : "Offline payment recorded and booking finalized.",
        reference: payloadString(payload, "reference"),
        deliveryChannel: rail,
        adminProfileId: row.adminProfileId,
        previousReference: null,
        severity: "info",
        milestone: true,
      });
      return entries;
    }
    default:
      return null;
  }
}

function mapAuditRowsToTimelineEntries(row: AdminBookingAssistAuditRow): AdminAssistTimelineEntry[] {
  const mapped = mapAuditToTimelineEntry(row);
  if (!mapped) return [];
  if (Array.isArray(mapped)) return mapped;
  return [mapped];
}

const POST_PAYMENT_STATUSES: readonly BookingStatus[] = [
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
];

function paymentConfirmedDescription(input: {
  audits: AdminBookingAssistAuditRow[];
  paymentProvider: string | null;
}): string {
  const hadOffline = input.audits.some((a) => a.action === "admin_booking_offline_payment_recorded");
  const provider = input.paymentProvider?.trim().toLowerCase() ?? "";
  if (hadOffline || provider === "eft" || provider === "cash" || provider === "card_machine") {
    return "Offline payment finalized; booking lifecycle continued via finalizePaidBooking.";
  }
  return "Paystack confirmed payment; booking lifecycle continued via finalizePaidBooking.";
}

export function buildAdminBookingAssistTimeline(input: {
  audits: AdminBookingAssistAuditRow[];
  bookingStatus: BookingStatus;
  paymentLink: AdminAssistPaymentLinkMetadata | null;
  paymentConfirmedAt: string | null;
  paymentProvider?: string | null;
  nowMs?: number;
}): AdminAssistTimelineEntry[] {
  const nowMs = input.nowMs ?? Date.now();
  const entries: AdminAssistTimelineEntry[] = [];

  for (const audit of input.audits) {
    entries.push(...mapAuditRowsToTimelineEntries(audit));
  }

  if (
    input.paymentLink &&
    isAdminAssistPaymentLinkExpired(input.paymentLink, nowMs) &&
    !entries.some((e) => e.kind === "payment_link_expired" && e.reference === input.paymentLink?.reference)
  ) {
    entries.push({
      id: `derived-expired-${input.paymentLink.reference}`,
      at: input.paymentLink.expiresAt,
      kind: "payment_link_expired",
      title: "Payment link expired",
      description: "Checkout link passed its expiry time (derived).",
      reference: input.paymentLink.reference,
      deliveryChannel: input.paymentLink.deliveryChannel,
      adminProfileId: input.paymentLink.generatedByProfileId,
      previousReference: null,
    });
  }

  if (input.paymentConfirmedAt && POST_PAYMENT_STATUSES.includes(input.bookingStatus)) {
    entries.push({
      id: `derived-confirmed-${input.paymentConfirmedAt}`,
      at: input.paymentConfirmedAt,
      kind: "payment_confirmed",
      title: "Payment confirmed",
      description: paymentConfirmedDescription({
        audits: input.audits,
        paymentProvider: input.paymentProvider ?? null,
      }),
      reference: input.paymentLink?.reference ?? null,
      deliveryChannel: null,
      adminProfileId: null,
      previousReference: null,
      severity: "info",
      milestone: true,
    });
  }

  if (
    input.paymentConfirmedAt &&
    input.bookingStatus === "confirmed"
  ) {
    entries.push({
      id: `derived-assignment-escalation-${input.paymentConfirmedAt}`,
      at: input.paymentConfirmedAt,
      kind: "assignment_escalation",
      title: "Assignment escalation attention",
      description: "Payment confirmed but booking has not reached pending_assignment.",
      reference: null,
      deliveryChannel: null,
      adminProfileId: null,
      previousReference: null,
      severity: "critical",
      milestone: true,
    });
  }

  if (
    input.paymentConfirmedAt &&
    (input.bookingStatus === "pending_assignment" ||
      input.bookingStatus === "assigned" ||
      input.bookingStatus === "in_progress")
  ) {
    const assignmentAt = new Date(
      new Date(input.paymentConfirmedAt).getTime() + 1,
    ).toISOString();
    entries.push({
      id: `derived-assignment-${input.paymentConfirmedAt}`,
      at: assignmentAt,
      kind: "assignment_started",
      title:
        input.bookingStatus === "pending_assignment"
          ? "Assignment started"
          : "Assignment in progress",
      description:
        input.bookingStatus === "pending_assignment"
          ? "Post-payment assignment dispatch is running (canonical finalize path)."
          : "Cleaner assignment progressed after payment confirmation.",
      reference: null,
      deliveryChannel: null,
      adminProfileId: null,
      previousReference: null,
      severity: "info",
      milestone: true,
    });
  }

  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
