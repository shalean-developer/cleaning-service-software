import type { AdminBookingFlowSnapshot } from "./adminBookingFlowState";

export type AdminBookingWizardFlowBookingDetail = {
  id: string;
  customerId: string;
  status: string;
  paymentStatus: string | null;
  priceCents: number;
  adminAssistPaymentLink: {
    paymentUrl: string;
    reference: string;
    expiresAt: string;
  } | null;
  adminAssistPaymentTimeline: {
    kind: string;
    deliveryChannel: string | null;
    title: string;
  }[];
  paymentLinkExpired?: boolean;
  paymentLinkActive?: boolean;
  pendingPaymentAgeHours?: number | null;
  failedEmailNotification?: boolean;
  customerHasEmail?: boolean;
  nextRecommendedAction?: { label: string; reason: string } | null;
  lastOperatorLabel?: string | null;
};

export type AdminBookingFlowServerStatus = {
  bookingId: string;
  status: string;
  paymentStatus: string | null;
  offlinePaymentRecorded: boolean;
  bookingConfirmed: boolean;
  emailRequestSent: boolean;
  whatsappMessageSent: boolean;
  syncedAt: string;
  paymentLinkExpired?: boolean;
  paymentLinkActive?: boolean;
  pendingPaymentAgeHours?: number | null;
  pendingPaymentStale?: boolean;
  failedEmailNotification?: boolean;
  customerHasEmail?: boolean;
  nextRecommendedAction?: { label: string; reason: string } | null;
  lastOperatorLabel?: string | null;
};

const CONFIRMED_STATUSES = new Set([
  "confirmed",
  "pending_assignment",
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
]);

const STALE_PENDING_HOURS = 72;

export function deriveServerFlagsFromBookingDetail(
  booking: AdminBookingWizardFlowBookingDetail,
): Omit<
  AdminBookingFlowServerStatus,
  "bookingId" | "status" | "paymentStatus" | "syncedAt"
> {
  const timeline = booking.adminAssistPaymentTimeline ?? [];
  const emailRequestSent = timeline.some(
    (entry) =>
      entry.kind === "payment_request_sent" &&
      (entry.deliveryChannel === "email" || entry.title.toLowerCase().includes("email")),
  );
  const whatsappMessageSent = timeline.some(
    (entry) =>
      entry.kind === "payment_request_sent" &&
      (entry.deliveryChannel === "whatsapp_copy" ||
        entry.title.toLowerCase().includes("whatsapp")),
  );
  const offlinePaymentRecorded = timeline.some((entry) => entry.kind === "offline_payment_recorded");
  const bookingConfirmed =
    CONFIRMED_STATUSES.has(booking.status) &&
    (booking.paymentStatus === "paid" || offlinePaymentRecorded);

  const pendingPaymentAgeHours = booking.pendingPaymentAgeHours ?? null;
  const pendingPaymentStale =
    pendingPaymentAgeHours != null && pendingPaymentAgeHours >= STALE_PENDING_HOURS;

  return {
    emailRequestSent,
    whatsappMessageSent,
    offlinePaymentRecorded,
    bookingConfirmed,
    paymentLinkExpired: booking.paymentLinkExpired ?? false,
    paymentLinkActive: booking.paymentLinkActive ?? false,
    pendingPaymentAgeHours,
    pendingPaymentStale,
    failedEmailNotification: booking.failedEmailNotification ?? false,
    customerHasEmail: booking.customerHasEmail ?? false,
    nextRecommendedAction: booking.nextRecommendedAction ?? null,
    lastOperatorLabel: booking.lastOperatorLabel ?? null,
  };
}

export function mergeAdminBookingFlowFromServerDetail(
  current: AdminBookingFlowSnapshot,
  booking: AdminBookingWizardFlowBookingDetail,
): AdminBookingFlowSnapshot {
  const serverFlags = deriveServerFlagsFromBookingDetail(booking);
  const link = booking.adminAssistPaymentLink;
  const hasDraftOrBeyond =
    booking.status === "draft" ||
    booking.status === "pending_payment" ||
    CONFIRMED_STATUSES.has(booking.status);

  return {
    saved: hasDraftOrBeyond
      ? {
          bookingId: booking.id,
          customerId: booking.customerId,
          priceCents: booking.priceCents,
        }
      : current.saved,
    pendingPayment:
      booking.status === "pending_payment" || CONFIRMED_STATUSES.has(booking.status)
        ? { bookingId: booking.id }
        : current.pendingPayment,
    paymentLink: link
      ? {
          paymentUrl: link.paymentUrl,
          reference: link.reference,
          expiresAt: link.expiresAt,
        }
      : current.paymentLink,
    emailRequestSent: current.emailRequestSent || serverFlags.emailRequestSent,
    whatsappCopied: current.whatsappCopied || serverFlags.whatsappMessageSent,
    serverStatus: {
      bookingId: booking.id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      syncedAt: new Date().toISOString(),
      ...serverFlags,
    },
  };
}

export function resolveAdminBookingServerStatusLabel(
  serverStatus: AdminBookingFlowServerStatus | null | undefined,
): string | null {
  if (!serverStatus) return null;
  const payment = serverStatus.paymentStatus ? ` · payment ${serverStatus.paymentStatus}` : "";
  return `Server: ${serverStatus.status.replace(/_/g, " ")}${payment}`;
}

export function mapAssistSummaryToFlowBookingDetail(
  summary: AdminBookingWizardFlowBookingDetail,
): AdminBookingWizardFlowBookingDetail {
  return summary;
}
