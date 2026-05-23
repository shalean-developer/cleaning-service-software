import "server-only";

import {
  completePaystackBookingCheckout,
  findPendingPaymentForBooking,
} from "@/features/payments/server/completePaystackBookingCheckout";
import { isPaystackEnabled } from "@/features/payments/server/paystackEnv";
import { updatePaymentLinkMetadata } from "@/features/payments/server/paymentRepository";
import { resolveCustomerEmail } from "@/features/notifications/server/resolveCustomerEmail";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import { isAdminAssistedPaymentLinksActive } from "@/lib/app/adminAssistedPaymentLinksFlag";
import type { CurrentUser } from "@/lib/auth/types";
import type { Json } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  findAdminBookingAssistPaymentLinkIdempotency,
  storeAdminBookingAssistIdempotencyResult,
  type AdminBookingPaymentLinkIdempotencyResult,
} from "./adminBookingAssistIdempotency";
import {
  isAdminAssistPaymentLinkActive,
  mergeAdminAssistPaymentLinkMetadata,
  readAdminAssistPaymentLinkMetadata,
  readAdminAssistSupersededPaymentLinks,
  supersedeAdminAssistPaymentLink,
  type AdminAssistPaymentLinkMetadata,
} from "./adminAssistPaymentLinkMetadata";
import type { AdminGeneratePaymentLinkBody } from "./parseAdminGeneratePaymentLinkBody";
import { recordAdminBookingAssistAudit } from "./recordAdminBookingAssistAudit";
import { sanitizeAdminBookingAssistAuditPayload } from "./buildAdminBookingDraftMetadata";
import { validateAdminAssistedPendingPaymentForPaymentLink } from "./validateAdminAssistedBookingReady";

const DEFAULT_PAYMENT_LINK_TTL_HOURS = 24;

function paymentLinkExpiresAtIso(hours: number = DEFAULT_PAYMENT_LINK_TTL_HOURS): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

export type AdminGeneratePaymentLinkInput = {
  admin: CurrentUser;
  bookingId: string;
  body: AdminGeneratePaymentLinkBody;
};

export type AdminPaymentLinkResult = {
  bookingId: string;
  paymentUrl: string;
  reference: string;
  expiresAt: string;
  idempotent: boolean;
};

export type AdminGeneratePaymentLinkResult =
  | { ok: true; paymentLink: AdminPaymentLinkResult }
  | {
      ok: false;
      code:
        | "FORBIDDEN"
        | "FEATURE_DISABLED"
        | "PAYSTACK_DISABLED"
        | "INVALID_PAYLOAD"
        | "BOOKING_NOT_FOUND"
        | "WRONG_CUSTOMER"
        | "INVALID_STATUS"
        | "NOT_ADMIN_ASSISTED"
        | "INCOMPLETE_BOOKING"
        | "NO_PENDING_PAYMENT"
        | "CUSTOMER_EMAIL_MISSING"
        | "PAYMENT_LINK_FAILED"
        | "PERSISTENCE_ERROR";
      message: string;
      status: number;
    };

function fail(
  code: Extract<AdminGeneratePaymentLinkResult, { ok: false }>["code"],
  message: string,
  status: number,
): AdminGeneratePaymentLinkResult {
  return { ok: false, code, message, status };
}

async function recordRejectionAudit(input: {
  adminProfileId: string;
  customerId: string;
  bookingId: string;
  idempotencyKey: string;
  reasonCode: string;
  message: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  try {
    const client = requireServiceRoleClient();
    await recordAdminBookingAssistAudit(client, {
      adminProfileId: input.adminProfileId,
      customerId: input.customerId,
      bookingId: input.bookingId,
      action: "admin_booking_payment_link_rejected",
      idempotencyKey: input.idempotencyKey,
      payload: sanitizeAdminBookingAssistAuditPayload({
        reasonCode: input.reasonCode,
        message: input.message,
        ...input.payload,
      }) as Json,
    });
  } catch {
    // Best-effort rejection audit.
  }
}

export async function adminGeneratePaymentLinkFacade(
  input: AdminGeneratePaymentLinkInput,
): Promise<AdminGeneratePaymentLinkResult> {
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

  if (!isPaystackEnabled()) {
    return fail("PAYSTACK_DISABLED", "Paystack is not enabled.", 503);
  }

  const idempotencyKey = body.idempotencyKey.trim();
  const customerId = body.customerId;
  const serviceClient = requireServiceRoleClient();

  const existing = await findAdminBookingAssistPaymentLinkIdempotency(
    serviceClient,
    idempotencyKey,
  );
  if (existing && existing.bookingId === bookingId && !body.regenerate) {
    const backend = createBookingCommandBackend();
    const booking = await backend.getBooking(bookingId);
    if (
      booking &&
      booking.status === "pending_payment" &&
      booking.customer_id === customerId &&
      isAdminAssistPaymentLinkActive({
        paymentUrl: existing.paymentUrl,
        reference: existing.reference,
        expiresAt: existing.expiresAt,
        generatedAt: existing.expiresAt,
        generatedByProfileId: admin.profileId,
        deliveryChannel: body.deliveryChannel,
        paymentId: "",
      })
    ) {
      await recordAdminBookingAssistAudit(serviceClient, {
        adminProfileId: admin.profileId,
        customerId,
        bookingId,
        action: "admin_booking_payment_link_idempotency_replayed",
        idempotencyKey,
        payload: {
          bookingId: existing.bookingId,
          reference: existing.reference,
          expiresAt: existing.expiresAt,
        } as Json,
      }).catch(() => undefined);

      return {
        ok: true,
        paymentLink: {
          bookingId: existing.bookingId,
          paymentUrl: existing.paymentUrl,
          reference: existing.reference,
          expiresAt: existing.expiresAt,
          idempotent: true,
        },
      };
    }
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
    const rejection = fail("WRONG_CUSTOMER", "Booking does not belong to this customer.", 403);
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: {},
    });
    return rejection;
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
          : "INCOMPLETE_BOOKING";
    const rejection = fail(code, validation.message, code === "INVALID_STATUS" ? 409 : 422);
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { validationCode: validation.code },
    });
    return rejection;
  }

  const payment = await findPendingPaymentForBooking(bookingId);
  if (!payment) {
    const rejection = fail(
      "NO_PENDING_PAYMENT",
      "No pending payment row found. Create an unpaid booking first.",
      409,
    );
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: {},
    });
    return rejection;
  }

  const emailResult = await resolveCustomerEmail(serviceClient, customerId);
  if (!emailResult.ok || !emailResult.recipient.email?.trim()) {
    const rejection = fail(
      "CUSTOMER_EMAIL_MISSING",
      "Customer email is required to generate a Paystack payment link.",
      422,
    );
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: {},
    });
    return rejection;
  }

  const checkout = await completePaystackBookingCheckout({
    bookingId,
    payment,
    email: emailResult.recipient.email,
    lockId: null,
    metadataSource: "admin_assisted",
  });

  if (!checkout.ok) {
    const rejection = fail(
      "PAYMENT_LINK_FAILED",
      checkout.message,
      checkout.status,
    );
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId,
      bookingId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { checkoutCode: checkout.code },
    });
    return rejection;
  }

  const expiresAt = paymentLinkExpiresAtIso();
  const generatedAt = new Date().toISOString();
  const previousLink = readAdminAssistPaymentLinkMetadata(booking.metadata);
  const previousReference = previousLink?.reference ?? null;
  let supersededLinks = readAdminAssistSupersededPaymentLinks(booking.metadata);
  if (previousLink) {
    supersededLinks = [...supersededLinks, supersedeAdminAssistPaymentLink(previousLink)];
  }

  const linkMeta: AdminAssistPaymentLinkMetadata = {
    paymentUrl: checkout.authorizationUrl,
    reference: checkout.reference,
    expiresAt,
    generatedAt,
    generatedByProfileId: admin.profileId,
    deliveryChannel: body.deliveryChannel,
    paymentId: checkout.paymentId,
    status: "active",
  };

  const paymentMetadata =
    payment.metadata && typeof payment.metadata === "object" && !Array.isArray(payment.metadata)
      ? { ...(payment.metadata as Record<string, unknown>) }
      : {};
  paymentMetadata.adminAssist = {
    source: "admin_wizard",
    authorizationUrl: checkout.authorizationUrl,
    reference: checkout.reference,
    generatedAt,
    generatedByProfileId: admin.profileId,
  };

  await updatePaymentLinkMetadata(serviceClient, checkout.paymentId, {
    providerRef: checkout.reference,
    paymentLinkExpiresAt: expiresAt,
    metadata: paymentMetadata,
  });

  const mergedBookingMetadata = mergeAdminAssistPaymentLinkMetadata(booking.metadata, linkMeta, {
    supersededLinks,
  });
  await backend.updateBookingMetadata(bookingId, mergedBookingMetadata as Json);

  const stored: AdminBookingPaymentLinkIdempotencyResult = {
    bookingId,
    status: "payment_link",
    paymentUrl: checkout.authorizationUrl,
    reference: checkout.reference,
    expiresAt,
    priceCents: booking.price_cents,
    currency: booking.currency,
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
    const raced = await findAdminBookingAssistPaymentLinkIdempotency(
      serviceClient,
      idempotencyKey,
    );
    if (raced) {
      return {
        ok: true,
        paymentLink: {
          bookingId: raced.bookingId,
          paymentUrl: raced.paymentUrl,
          reference: raced.reference,
          expiresAt: raced.expiresAt,
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

  const linkAuditAction = previousReference
    ? "admin_booking_payment_link_regenerated"
    : "admin_booking_payment_link_generated";

  await recordAdminBookingAssistAudit(serviceClient, {
    adminProfileId: admin.profileId,
    customerId,
    bookingId,
    action: linkAuditAction,
    idempotencyKey,
    payload: sanitizeAdminBookingAssistAuditPayload({
      bookingId,
      paymentUrl: checkout.authorizationUrl,
      reference: checkout.reference,
      previousReference,
      expiresAt,
      deliveryChannel: body.deliveryChannel,
      regenerated: Boolean(previousReference),
      notificationDeferred:
        body.deliveryChannel !== "copy_only"
          ? "payment_request_sent template not implemented; copy link manually"
          : null,
      reason: body.reason?.trim() || null,
    }) as Json,
  });

  return {
    ok: true,
    paymentLink: {
      bookingId,
      paymentUrl: checkout.authorizationUrl,
      reference: checkout.reference,
      expiresAt,
      idempotent: checkout.reference === payment.provider_ref,
    },
  };
}
