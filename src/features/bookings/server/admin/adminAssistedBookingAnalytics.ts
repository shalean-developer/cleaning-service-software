import type { AdminBookingAssistAuditAction } from "./recordAdminBookingAssistAudit";

export type AdminAssistAuditEvent = {
  bookingId: string | null;
  action: AdminBookingAssistAuditAction | string;
  createdAt: string;
  payload: Record<string, unknown>;
};

export type AdminAssistedBookingAnalytics = {
  linksGenerated: number;
  linksRegenerated: number;
  emailsSent: number;
  whatsappCopied: number;
  expiredLinks: number;
  paymentRequestsSentToday: number;
  conversionRateGeneratedToPaid: number | null;
  averageDraftToPaidHours: number | null;
  averagePendingToConfirmedHours: number | null;
};

const POST_PAYMENT_ACTIONS = new Set([
  "admin_booking_offline_payment_recorded",
]);

function payloadChannel(payload: Record<string, unknown>): string | null {
  const channel = payload.deliveryChannel;
  return typeof channel === "string" ? channel : null;
}

function payloadNotificationStatus(payload: Record<string, unknown>): string | null {
  const status = payload.notificationStatus;
  return typeof status === "string" ? status : null;
}

function startOfTodayIso(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function computeAdminAssistedBookingAnalytics(
  audits: AdminAssistAuditEvent[],
  paidBookingIds: Set<string>,
  now = new Date(),
): AdminAssistedBookingAnalytics {
  const todayStartMs = Date.parse(startOfTodayIso(now));

  let linksGenerated = 0;
  let linksRegenerated = 0;
  let emailsSent = 0;
  let whatsappCopied = 0;
  let expiredLinks = 0;
  let paymentRequestsSentToday = 0;

  const draftCreatedAt = new Map<string, number>();
  const pendingCreatedAt = new Map<string, number>();
  const confirmedAt = new Map<string, number>();
  const generatedBookingIds = new Set<string>();

  for (const row of audits) {
    const bookingId = row.bookingId;
    const atMs = Date.parse(row.createdAt);
    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};

    if (atMs >= todayStartMs && row.action === "admin_booking_payment_request_sent") {
      paymentRequestsSentToday += 1;
    }

    switch (row.action) {
      case "admin_booking_payment_link_generated":
        linksGenerated += 1;
        if (bookingId) generatedBookingIds.add(bookingId);
        break;
      case "admin_booking_payment_link_regenerated":
        linksRegenerated += 1;
        if (bookingId) generatedBookingIds.add(bookingId);
        break;
      case "admin_booking_payment_link_expired":
        expiredLinks += 1;
        break;
      case "admin_booking_payment_request_sent": {
        const channel = payloadChannel(payload);
        const status = payloadNotificationStatus(payload);
        if (channel === "email" || status === "queued") emailsSent += 1;
        if (channel === "whatsapp_copy" || status === "copied") whatsappCopied += 1;
        break;
      }
      case "admin_booking_draft_created":
        if (bookingId) draftCreatedAt.set(bookingId, atMs);
        break;
      case "admin_booking_pending_payment_created":
        if (bookingId) pendingCreatedAt.set(bookingId, atMs);
        break;
      case "admin_booking_offline_payment_recorded":
        if (bookingId) confirmedAt.set(bookingId, atMs);
        break;
      default:
        if (POST_PAYMENT_ACTIONS.has(row.action) && bookingId) {
          confirmedAt.set(bookingId, atMs);
        }
        break;
    }
  }

  for (const bookingId of paidBookingIds) {
    if (!confirmedAt.has(bookingId)) {
      confirmedAt.set(bookingId, now.getTime());
    }
  }

  let draftToPaidSum = 0;
  let draftToPaidCount = 0;
  for (const [bookingId, draftAt] of draftCreatedAt) {
    const paidAt = confirmedAt.get(bookingId);
    if (paidAt == null || paidAt <= draftAt) continue;
    draftToPaidSum += (paidAt - draftAt) / 3_600_000;
    draftToPaidCount += 1;
  }

  let pendingToConfirmedSum = 0;
  let pendingToConfirmedCount = 0;
  for (const [bookingId, pendingAt] of pendingCreatedAt) {
    const paidAt = confirmedAt.get(bookingId);
    if (paidAt == null || paidAt <= pendingAt) continue;
    pendingToConfirmedSum += (paidAt - pendingAt) / 3_600_000;
    pendingToConfirmedCount += 1;
  }

  let paidFromGenerated = 0;
  for (const bookingId of generatedBookingIds) {
    if (paidBookingIds.has(bookingId)) paidFromGenerated += 1;
  }

  return {
    linksGenerated,
    linksRegenerated,
    emailsSent,
    whatsappCopied,
    expiredLinks,
    paymentRequestsSentToday,
    conversionRateGeneratedToPaid:
      generatedBookingIds.size > 0 ? paidFromGenerated / generatedBookingIds.size : null,
    averageDraftToPaidHours:
      draftToPaidCount > 0 ? Math.round((draftToPaidSum / draftToPaidCount) * 10) / 10 : null,
    averagePendingToConfirmedHours:
      pendingToConfirmedCount > 0
        ? Math.round((pendingToConfirmedSum / pendingToConfirmedCount) * 10) / 10
        : null,
  };
}
