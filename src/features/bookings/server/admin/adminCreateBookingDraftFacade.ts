import "server-only";

import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { PRICING_CURRENCY } from "@/features/pricing/server/types";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import {
  isScheduleWithinBookingWindow,
  resolveScheduleOutsideWindowMessage,
} from "@/features/booking-wizard/bookingWindowConfig";
import { isAdminAssistedBookingEnabled } from "@/lib/app/adminAssistedBookingFlag";
import type { CurrentUser } from "@/lib/auth/types";
import type { Json } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  findAdminBookingAssistIdempotency,
  storeAdminBookingAssistIdempotency,
  type AdminBookingDraftIdempotencyResult,
} from "./adminBookingAssistIdempotency";
import {
  buildAdminBookingDraftMetadata,
  sanitizeAdminBookingAssistAuditPayload,
} from "./buildAdminBookingDraftMetadata";
import type { AdminCreateBookingDraftBody } from "./parseAdminCreateBookingDraftBody";
import { recordAdminBookingAssistAudit } from "./recordAdminBookingAssistAudit";
import { validateAdminRecurringScheduleForDraftBody } from "@/features/admin-booking-wizard/adminRecurringSchedule";
import { validateAdminWizardBillingMode } from "./validateAdminWizardBillingMode";

export type AdminCreateBookingDraftInput = {
  admin: CurrentUser;
  body: AdminCreateBookingDraftBody;
};

export type AdminBookingDraftResult = {
  bookingId: string;
  status: "draft";
  priceCents: number;
  currency: string;
  idempotent: boolean;
};

export type AdminCreateBookingDraftResult =
  | { ok: true; bookingDraft: AdminBookingDraftResult }
  | {
      ok: false;
      code:
        | "FORBIDDEN"
        | "FEATURE_DISABLED"
        | "INVALID_PAYLOAD"
        | "INVALID_SCHEDULE"
        | "CUSTOMER_NOT_FOUND"
        | "QUOTE_FAILED"
        | "PERSISTENCE_ERROR";
      message: string;
      status: number;
    };

function fail(
  code: Extract<AdminCreateBookingDraftResult, { ok: false }>["code"],
  message: string,
  status: number,
): Extract<AdminCreateBookingDraftResult, { ok: false }> {
  return { ok: false, code, message, status };
}

function isScheduleInPast(scheduledStart: string): boolean {
  return new Date(scheduledStart).getTime() < Date.now();
}

async function assertCustomerExists(
  customerId: string,
): Promise<Extract<AdminCreateBookingDraftResult, { ok: false }> | null> {
  const client = requireServiceRoleClient();
  const { data, error } = await client
    .from("customers")
    .select("id")
    .eq("id", customerId)
    .maybeSingle();

  if (error) {
    return fail("PERSISTENCE_ERROR", error.message, 500);
  }
  if (!data?.id) {
    return fail("CUSTOMER_NOT_FOUND", "Customer not found.", 404);
  }
  return null;
}

async function recordRejectionAudit(input: {
  adminProfileId: string;
  customerId: string;
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
      action: "admin_booking_draft_rejected",
      idempotencyKey: input.idempotencyKey,
      payload: sanitizeAdminBookingAssistAuditPayload({
        reasonCode: input.reasonCode,
        message: input.message,
        ...input.payload,
      }) as Json,
    });
  } catch {
    // Best-effort rejection audit; do not mask the original failure.
  }
}

export async function adminCreateBookingDraftFacade(
  input: AdminCreateBookingDraftInput,
): Promise<AdminCreateBookingDraftResult> {
  const { admin, body } = input;

  if (admin.role !== "admin") {
    return fail("FORBIDDEN", "Admins only.", 403);
  }

  if (!isAdminAssistedBookingEnabled()) {
    return fail(
      "FEATURE_DISABLED",
      "Admin-assisted booking is not enabled. Set ADMIN_ASSISTED_BOOKING_ENABLED=true after rollout sign-off.",
      403,
    );
  }

  const idempotencyKey = body.idempotencyKey.trim();
  const onBehalfOfCustomerId = body.customerId;
  const serviceClient = requireServiceRoleClient();

  const existing = await findAdminBookingAssistIdempotency(serviceClient, idempotencyKey);
  if (existing) {
    if (existing.bookingId) {
      const booking = await createBookingCommandBackend().getBooking(existing.bookingId);
      if (booking && booking.customer_id === onBehalfOfCustomerId && booking.status === "draft") {
        await recordAdminBookingAssistAudit(serviceClient, {
          adminProfileId: admin.profileId,
          customerId: onBehalfOfCustomerId,
          bookingId: existing.bookingId,
          action: "admin_booking_draft_idempotency_replayed",
          idempotencyKey,
          payload: {
            bookingId: existing.bookingId,
            status: existing.status,
            priceCents: existing.priceCents,
          } as Json,
        }).catch(() => undefined);

        return {
          ok: true,
          bookingDraft: {
            bookingId: existing.bookingId,
            status: "draft",
            priceCents: existing.priceCents,
            currency: existing.currency,
            idempotent: true,
          },
        };
      }
    }
    return fail(
      "INVALID_PAYLOAD",
      "Idempotency key was used for a different customer or booking.",
      409,
    );
  }

  const customerCheck = await assertCustomerExists(onBehalfOfCustomerId);
  if (customerCheck) {
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId: onBehalfOfCustomerId,
      idempotencyKey,
      reasonCode: customerCheck.code,
      message: customerCheck.message,
      payload: { phase: "customer_lookup" },
    });
    return customerCheck;
  }

  if (isScheduleInPast(body.scheduledStart)) {
    const rejection = fail("INVALID_SCHEDULE", "Cannot create a draft booking in the past.", 400);
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId: onBehalfOfCustomerId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { scheduledStart: body.scheduledStart },
    });
    return rejection;
  }

  if (!isScheduleWithinBookingWindow(body.scheduledStart)) {
    const rejection = fail(
      "INVALID_SCHEDULE",
      resolveScheduleOutsideWindowMessage(body.scheduledStart),
      400,
    );
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId: onBehalfOfCustomerId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { scheduledStart: body.scheduledStart },
    });
    return rejection;
  }

  const recurringScheduleError = validateAdminRecurringScheduleForDraftBody({
    pricingFrequency: body.pricingInput.frequency,
    recurringSchedule: body.recurringSchedule ?? null,
  });
  if (recurringScheduleError) {
    const rejection = fail("INVALID_PAYLOAD", recurringScheduleError, 400);
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId: onBehalfOfCustomerId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { recurringSchedule: body.recurringSchedule ?? null },
    });
    return rejection;
  }

  const billingValidation = await validateAdminWizardBillingMode({
    customerId: onBehalfOfCustomerId,
    adminProfileId: admin.profileId,
    billing: body.billing ?? { mode: "paystack_link" },
  });
  if (!billingValidation.ok) {
    const rejection = fail("INVALID_PAYLOAD", billingValidation.message, 422);
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId: onBehalfOfCustomerId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { billingMode: body.billing.mode },
    });
    return rejection;
  }

  const quoteResult = calculateQuote(body.pricingInput);
  if (!quoteResult.ok) {
    const rejection = fail("QUOTE_FAILED", quoteResult.message, 422);
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId: onBehalfOfCustomerId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { quoteCode: quoteResult.code },
    });
    return rejection;
  }

  const bookingMetadata = buildAdminBookingDraftMetadata({
    adminProfileId: admin.profileId,
    idempotencyKey,
    pricingInput: body.pricingInput,
    breakdown: quoteResult.breakdown,
    address: body.address,
    cleanerPreferenceMode: body.cleanerPreferenceMode,
    selectedCleanerId: body.selectedCleanerId,
    recurringSchedule: body.recurringSchedule ?? null,
    billing: billingValidation.billing,
  });

  const backend = createBookingCommandBackend();
  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor: { actorType: "admin", profileId: admin.profileId },
      customerId: onBehalfOfCustomerId,
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
      priceCents: quoteResult.breakdown.totalCents,
      currency: quoteResult.breakdown.currency ?? PRICING_CURRENCY,
      serviceId: body.serviceId ?? null,
      metadata: bookingMetadata,
      idempotencyKey,
      reason: "admin_assisted_draft",
    },
    {},
  );

  if (!draft.ok) {
    const rejection = fail(
      draft.code === "FORBIDDEN" ? "FORBIDDEN" : "PERSISTENCE_ERROR",
      draft.message,
      draft.code === "FORBIDDEN" ? 403 : 500,
    );
    await recordRejectionAudit({
      adminProfileId: admin.profileId,
      customerId: onBehalfOfCustomerId,
      idempotencyKey,
      reasonCode: rejection.code,
      message: rejection.message,
      payload: { commandCode: draft.code },
    });
    return rejection;
  }

  if (draft.status !== "draft") {
    return fail(
      "PERSISTENCE_ERROR",
      `Expected draft status after CREATE_BOOKING_DRAFT, got "${draft.status}".`,
      500,
    );
  }

  const bookingDraft: AdminBookingDraftIdempotencyResult = {
    bookingId: draft.bookingId,
    status: "draft",
    priceCents: quoteResult.breakdown.totalCents,
    currency: quoteResult.breakdown.currency ?? PRICING_CURRENCY,
    idempotent: draft.idempotent,
  };

  try {
    await storeAdminBookingAssistIdempotency(serviceClient, {
      idempotencyKey,
      adminProfileId: admin.profileId,
      customerId: onBehalfOfCustomerId,
      result: { ...bookingDraft, idempotent: false },
    });
  } catch (e) {
    const raced = await findAdminBookingAssistIdempotency(serviceClient, idempotencyKey);
    if (raced) {
      return {
        ok: true,
        bookingDraft: {
          bookingId: raced.bookingId,
          status: "draft",
          priceCents: raced.priceCents,
          currency: raced.currency,
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

  const auditPayload = sanitizeAdminBookingAssistAuditPayload({
    pricing: {
      totalCents: quoteResult.breakdown.totalCents,
      currency: quoteResult.breakdown.currency,
      lineItemCount: quoteResult.breakdown.lineItems.length,
    },
    schedule: {
      scheduledStart: body.scheduledStart,
      scheduledEnd: body.scheduledEnd,
    },
    bookingMetadata,
  });

  await recordAdminBookingAssistAudit(serviceClient, {
    adminProfileId: admin.profileId,
    customerId: onBehalfOfCustomerId,
    bookingId: draft.bookingId,
    action: "admin_booking_draft_created",
    idempotencyKey,
    payload: auditPayload as Json,
  });

  return {
    ok: true,
    bookingDraft: {
      bookingId: draft.bookingId,
      status: "draft",
      priceCents: bookingDraft.priceCents,
      currency: bookingDraft.currency,
      idempotent: draft.idempotent,
    },
  };
}
