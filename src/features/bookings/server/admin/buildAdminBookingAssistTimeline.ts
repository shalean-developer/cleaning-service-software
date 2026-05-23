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
  | "payment_confirmed";

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
};

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapAuditToTimelineEntry(row: AdminBookingAssistAuditRow): AdminAssistTimelineEntry | null {
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
        kind: "payment_request_sent",
        title,
        description,
        reference: payloadString(payload, "reference"),
        deliveryChannel: channel,
        adminProfileId: row.adminProfileId,
        previousReference: null,
      };
    }
    default:
      return null;
  }
}

export function buildAdminBookingAssistTimeline(input: {
  audits: AdminBookingAssistAuditRow[];
  bookingStatus: BookingStatus;
  paymentLink: AdminAssistPaymentLinkMetadata | null;
  paymentConfirmedAt: string | null;
  nowMs?: number;
}): AdminAssistTimelineEntry[] {
  const nowMs = input.nowMs ?? Date.now();
  const entries: AdminAssistTimelineEntry[] = [];

  for (const audit of input.audits) {
    const mapped = mapAuditToTimelineEntry(audit);
    if (mapped) entries.push(mapped);
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

  if (
    input.paymentConfirmedAt &&
    (input.bookingStatus === "confirmed" ||
      input.bookingStatus === "pending_assignment" ||
      input.bookingStatus === "assigned" ||
      input.bookingStatus === "in_progress" ||
      input.bookingStatus === "completed" ||
      input.bookingStatus === "payout_ready" ||
      input.bookingStatus === "paid_out")
  ) {
    entries.push({
      id: `derived-confirmed-${input.paymentConfirmedAt}`,
      at: input.paymentConfirmedAt,
      kind: "payment_confirmed",
      title: "Payment confirmed",
      description: "Paystack confirmed payment; booking lifecycle continued.",
      reference: input.paymentLink?.reference ?? null,
      deliveryChannel: null,
      adminProfileId: null,
      previousReference: null,
    });
  }

  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
