import "server-only";

import { getNotificationDeliveryConfig } from "@/features/notifications/server/config";
import { resolveCustomerEmail } from "@/features/notifications/server/resolveCustomerEmail";
import {
  ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE,
  buildAdminAssistedPaymentRequestEmail,
  buildAdminAssistedPaymentRequestWhatsAppCopy,
} from "@/features/notifications/server/templates/adminAssistedPaymentRequest";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { isAdminAssistedPaymentLinksActive } from "@/lib/app/adminAssistedPaymentLinksFlag";
import type { CurrentUser } from "@/lib/auth/types";
import type { Json } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  findAdminBookingAssistPaymentRequestNotificationIdempotency,
  storeAdminBookingAssistIdempotencyResult,
  type AdminBookingPaymentRequestNotificationIdempotencyResult,
} from "./adminBookingAssistIdempotency";
import {
  isAdminAssistPaymentLinkActive,
  readAdminAssistPaymentLinkMetadata,
} from "./adminAssistPaymentLinkMetadata";
import type { AdminSendPaymentRequestNotificationBody } from "./parseAdminSendPaymentRequestNotificationBody";
import { recordAdminBookingAssistAudit } from "./recordAdminBookingAssistAudit";
import { sanitizeAdminBookingAssistAuditPayload } from "./buildAdminBookingDraftMetadata";
import { redactPaymentUrlForAudit } from "./redactPaymentUrlForAudit";
import { validateAdminAssistedPendingPaymentForPaymentLink } from "./validateAdminAssistedBookingReady";

export type AdminSendPaymentRequestNotificationInput = {
  admin: CurrentUser;
  bookingId: string;
  body: AdminSendPaymentRequestNotificationBody;
};

export type AdminPaymentRequestNotificationResult = {
  bookingId: string;
  deliveryChannel: "email" | "whatsapp_copy";
  status: "queued" | "copied";
  paymentUrl: string;
  reference: string;
  copiedText?: string;
  notificationOutboxId?: string;
  idempotent: boolean;
};

export type AdminSendPaymentRequestNotificationResult =
  | { ok: true; notification: AdminPaymentRequestNotificationResult }
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
        | "NO_ACTIVE_PAYMENT_LINK"
        | "LINK_EXPIRED"
        | "CUSTOMER_EMAIL_MISSING"
        | "PERSISTENCE_ERROR";
      message: string;
      status: number;
    };

function fail(
  code: Extract<AdminSendPaymentRequestNotificationResult, { ok: false }>["code"],
  message: string,
  status: number,
): Extract<AdminSendPaymentRequestNotificationResult, { ok: false }> {
  return { ok: false, code, message, status };
}

async function enqueuePaymentRequestEmail(
  client: ReturnType<typeof requireServiceRoleClient>,
  input: {
    customerId: string;
    bookingId: string;
    paymentUrl: string;
    reference: string;
    expiresAt: string;
    optionalMessage?: string;
  },
): Promise<string> {
  const ts = new Date().toISOString();
  const payload: Json = {
    template: ADMIN_ASSISTED_PAYMENT_REQUEST_SENT_TEMPLATE,
    bookingId: input.bookingId,
    paymentUrl: input.paymentUrl,
    reference: input.reference,
    expiresAt: input.expiresAt,
    optionalMessage: input.optionalMessage ?? null,
  };

  const { data, error } = await client
    .from("notification_outbox")
    .insert({
      channel: "email",
      recipient: input.customerId,
      payload,
      status: "pending",
      attempts: 0,
      next_retry_at: null,
      last_error: null,
      created_at: ts,
      updated_at: ts,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data!.id;
}

export async function adminSendPaymentRequestNotificationFacade(
  input: AdminSendPaymentRequestNotificationInput,
): Promise<AdminSendPaymentRequestNotificationResult> {
  const { admin, bookingId, body } = input;

  if (admin.role !== "admin") {
    return fail("FORBIDDEN", "Admins only.", 403);
  }

  if (!isAdminAssistedPaymentLinksActive()) {
    return fail(
      "FEATURE_DISABLED",
      "Admin payment links are not enabled. Set ADMIN_ASSISTED_BOOKING_ENABLED=true and ADMIN_ASSISTED_PAYMENT_LINKS_ENABLED=true.",
      403,
    );
  }

  const idempotencyKey = body.idempotencyKey.trim();
  const customerId = body.customerId;
  const serviceClient = requireServiceRoleClient();

  const existing = await findAdminBookingAssistPaymentRequestNotificationIdempotency(
    serviceClient,
    idempotencyKey,
  );
  if (existing && existing.bookingId === bookingId) {
    await recordAdminBookingAssistAudit(serviceClient, {
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      action: "admin_booking_payment_request_sent",
      idempotencyKey,
      payload: {
        idempotentReplay: true,
        deliveryChannel: existing.deliveryChannel,
        notificationStatus: existing.notificationStatus,
        reference: existing.reference,
      } as Json,
    }).catch(() => undefined);

    return {
      ok: true,
      notification: {
        bookingId: existing.bookingId,
        deliveryChannel: existing.deliveryChannel,
        status: existing.notificationStatus,
        paymentUrl: existing.paymentUrl,
        reference: existing.reference,
        copiedText: existing.copiedText,
        notificationOutboxId: existing.notificationOutboxId,
        idempotent: true,
      },
    };
  } else if (existing) {
    return fail(
      "INVALID_PAYLOAD",
      "Idempotency key was used for a different booking.",
      409,
    );
  }

  const backend = createBookingCommandBackend();
  const booking = await backend.getBooking(bookingId);
  if (!booking) {
    return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
  }

  if (booking.customer_id !== customerId) {
    return fail("WRONG_CUSTOMER", "Booking does not belong to this customer.", 403);
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
    return fail(code, validation.message, code === "NOT_ADMIN_ASSISTED" ? 422 : 409);
  }

  const paymentLink = readAdminAssistPaymentLinkMetadata(booking.metadata);
  if (!paymentLink) {
    return fail(
      "NO_ACTIVE_PAYMENT_LINK",
      "No active payment link found. Generate a payment link first.",
      409,
    );
  }

  if (!isAdminAssistPaymentLinkActive(paymentLink)) {
    return fail(
      "LINK_EXPIRED",
      "Payment link has expired. Regenerate the link before sending a payment request.",
      409,
    );
  }

  const contentInput = {
    booking: {
      id: booking.id,
      scheduled_start: booking.scheduled_start,
      scheduled_end: booking.scheduled_end,
      price_cents: booking.price_cents,
      currency: booking.currency,
      metadata: booking.metadata ?? {},
    },
    customerDisplayName: null as string | null,
    paymentUrl: paymentLink.paymentUrl,
    expiresAt: paymentLink.expiresAt,
    supportEmail: getNotificationDeliveryConfig().supportEmail,
    optionalMessage: body.message ?? null,
  };

  if (body.deliveryChannel === "whatsapp_copy") {
    const whatsappCopy = buildAdminAssistedPaymentRequestWhatsAppCopy(contentInput);
    const stored: AdminBookingPaymentRequestNotificationIdempotencyResult = {
      bookingId,
      status: "payment_request_notification",
      deliveryChannel: "whatsapp_copy",
      notificationStatus: "copied",
      paymentUrl: paymentLink.paymentUrl,
      reference: paymentLink.reference,
      copiedText: whatsappCopy,
      idempotent: false,
    };

    try {
      await storeAdminBookingAssistIdempotencyResult(serviceClient, {
        idempotencyKey,
        adminProfileId: admin.profileId,
        customerId,
        result: stored,
      });
    } catch (e) {
      const raced = await findAdminBookingAssistPaymentRequestNotificationIdempotency(
        serviceClient,
        idempotencyKey,
      );
      if (raced) {
        return {
          ok: true,
          notification: {
            bookingId: raced.bookingId,
            deliveryChannel: raced.deliveryChannel,
            status: raced.notificationStatus,
            paymentUrl: raced.paymentUrl,
            reference: raced.reference,
            copiedText: raced.copiedText,
            idempotent: true,
          },
        };
      }
      return fail(
        "PERSISTENCE_ERROR",
        e instanceof Error ? e.message : "Could not store idempotency outcome.",
        500,
      );
    }

    await recordAdminBookingAssistAudit(serviceClient, {
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      action: "admin_booking_payment_request_sent",
      idempotencyKey,
      payload: sanitizeAdminBookingAssistAuditPayload({
        deliveryChannel: "whatsapp_copy",
        notificationStatus: "copied",
        reference: paymentLink.reference,
        paymentUrlRedacted: redactPaymentUrlForAudit(paymentLink.paymentUrl),
        reason: body.reason?.trim() || null,
      }) as Json,
    });

    return {
      ok: true,
      notification: {
        bookingId,
        deliveryChannel: "whatsapp_copy",
        status: "copied",
        paymentUrl: paymentLink.paymentUrl,
        reference: paymentLink.reference,
        copiedText: whatsappCopy,
        idempotent: false,
      },
    };
  }

  const emailResult = await resolveCustomerEmail(serviceClient, customerId);
  if (!emailResult.ok || !emailResult.recipient.email?.trim()) {
    return fail(
      "CUSTOMER_EMAIL_MISSING",
      "Customer email is required to send a payment request by email.",
      422,
    );
  }

  contentInput.customerDisplayName = emailResult.recipient.displayName;

  buildAdminAssistedPaymentRequestEmail(contentInput);

  let notificationOutboxId: string;
  try {
    notificationOutboxId = await enqueuePaymentRequestEmail(serviceClient, {
      customerId,
      bookingId,
      paymentUrl: paymentLink.paymentUrl,
      reference: paymentLink.reference,
      expiresAt: paymentLink.expiresAt,
      optionalMessage: body.message,
    });
  } catch (e) {
    return fail(
      "PERSISTENCE_ERROR",
      e instanceof Error ? e.message : "Could not queue payment request email.",
      500,
    );
  }

  const stored: AdminBookingPaymentRequestNotificationIdempotencyResult = {
    bookingId,
    status: "payment_request_notification",
    deliveryChannel: "email",
    notificationStatus: "queued",
    paymentUrl: paymentLink.paymentUrl,
    reference: paymentLink.reference,
    notificationOutboxId,
    idempotent: false,
  };

  try {
    await storeAdminBookingAssistIdempotencyResult(serviceClient, {
      idempotencyKey,
      adminProfileId: admin.profileId,
      customerId,
      result: stored,
    });
  } catch (e) {
    const raced = await findAdminBookingAssistPaymentRequestNotificationIdempotency(
      serviceClient,
      idempotencyKey,
    );
    if (raced) {
      return {
        ok: true,
        notification: {
          bookingId: raced.bookingId,
          deliveryChannel: raced.deliveryChannel,
          status: raced.notificationStatus,
          paymentUrl: raced.paymentUrl,
          reference: raced.reference,
          notificationOutboxId: raced.notificationOutboxId,
          idempotent: true,
        },
      };
    }
    return fail(
      "PERSISTENCE_ERROR",
      e instanceof Error ? e.message : "Could not store idempotency outcome.",
      500,
    );
  }

  await recordAdminBookingAssistAudit(serviceClient, {
    adminProfileId: admin.profileId,
    customerId,
    bookingId,
    action: "admin_booking_payment_request_sent",
    idempotencyKey,
    payload: sanitizeAdminBookingAssistAuditPayload({
      deliveryChannel: "email",
      notificationStatus: "queued",
      reference: paymentLink.reference,
      paymentUrlRedacted: redactPaymentUrlForAudit(paymentLink.paymentUrl),
      notificationOutboxId,
      reason: body.reason?.trim() || null,
    }) as Json,
  });

  return {
    ok: true,
    notification: {
      bookingId,
      deliveryChannel: "email",
      status: "queued",
      paymentUrl: paymentLink.paymentUrl,
      reference: paymentLink.reference,
      notificationOutboxId,
      idempotent: false,
    },
  };
}
