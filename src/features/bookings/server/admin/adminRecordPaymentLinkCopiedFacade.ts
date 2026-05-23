import "server-only";

import { isAdminAssistedPaymentLinksActive } from "@/lib/app/adminAssistedPaymentLinksFlag";
import type { CurrentUser } from "@/lib/auth/types";
import type { Json } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { readAdminAssistPaymentLinkMetadata } from "./adminAssistPaymentLinkMetadata";
import { recordAdminBookingAssistAudit } from "./recordAdminBookingAssistAudit";
import { sanitizeAdminBookingAssistAuditPayload } from "./buildAdminBookingDraftMetadata";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { validateAdminAssistedPendingPaymentForPaymentLink } from "./validateAdminAssistedBookingReady";

export type AdminRecordPaymentLinkCopiedInput = {
  admin: CurrentUser;
  bookingId: string;
  body: {
    customerId: string;
    idempotencyKey: string;
  };
};

export type AdminRecordPaymentLinkCopiedResult =
  | { ok: true; recorded: true }
  | {
      ok: false;
      code:
        | "FORBIDDEN"
        | "FEATURE_DISABLED"
        | "INVALID_PAYLOAD"
        | "BOOKING_NOT_FOUND"
        | "WRONG_CUSTOMER"
        | "INVALID_STATUS"
        | "NOT_ADMIN_ASSISTED"
        | "NO_PAYMENT_LINK";
      message: string;
      status: number;
    };

export async function adminRecordPaymentLinkCopiedFacade(
  input: AdminRecordPaymentLinkCopiedInput,
): Promise<AdminRecordPaymentLinkCopiedResult> {
  const { admin, bookingId, body } = input;

  if (admin.role !== "admin") {
    return { ok: false, code: "FORBIDDEN", message: "Admins only.", status: 403 };
  }

  if (!isAdminAssistedPaymentLinksActive()) {
    return {
      ok: false,
      code: "FEATURE_DISABLED",
      message: "Admin payment links are not enabled.",
      status: 403,
    };
  }

  const backend = createBookingCommandBackend();
  const booking = await backend.getBooking(bookingId);
  if (!booking) {
    return { ok: false, code: "BOOKING_NOT_FOUND", message: "Booking not found.", status: 404 };
  }

  if (booking.customer_id !== body.customerId) {
    return {
      ok: false,
      code: "WRONG_CUSTOMER",
      message: "Booking does not belong to this customer.",
      status: 403,
    };
  }

  const validation = validateAdminAssistedPendingPaymentForPaymentLink({
    id: booking.id,
    customer_id: booking.customer_id,
    status: booking.status,
    scheduled_start: booking.scheduled_start,
    scheduled_end: booking.scheduled_end,
    price_cents: booking.price_cents,
    metadata: booking.metadata,
  });

  if (!validation.ok) {
    const code =
      validation.code === "INVALID_STATUS"
        ? "INVALID_STATUS"
        : validation.code === "NOT_ADMIN_ASSISTED"
          ? "NOT_ADMIN_ASSISTED"
          : "INVALID_STATUS";
    return {
      ok: false,
      code,
      message: validation.message,
      status: code === "NOT_ADMIN_ASSISTED" ? 422 : 409,
    };
  }

  const paymentLink = readAdminAssistPaymentLinkMetadata(booking.metadata);
  if (!paymentLink) {
    return {
      ok: false,
      code: "NO_PAYMENT_LINK",
      message: "No active payment link on this booking.",
      status: 409,
    };
  }

  const serviceClient = requireServiceRoleClient();
  await recordAdminBookingAssistAudit(serviceClient, {
    adminProfileId: admin.profileId,
    customerId: body.customerId,
    bookingId,
    action: "admin_booking_payment_request_copied",
    idempotencyKey: body.idempotencyKey.trim(),
    payload: sanitizeAdminBookingAssistAuditPayload({
      bookingId,
      reference: paymentLink.reference,
      deliveryChannel: paymentLink.deliveryChannel,
    }) as Json,
  });

  return { ok: true, recorded: true };
}
