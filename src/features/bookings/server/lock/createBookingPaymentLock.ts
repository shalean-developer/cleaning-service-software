import "server-only";

import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import type { BookingCommandRunContext } from "@/features/bookings/server/commands/executeBookingCommand";
import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import {
  findLockByIdempotencyKey,
  insertBookingLock,
  isLockExpired,
  markLockExpired,
} from "./lockRepository";
import { hashLockInputs } from "./hashLockInputs";
import { validateCleanerPreferenceForLock } from "./validateCleanerPreference";
import type { BookingLockInput, BookingPaymentLockResult } from "./types";
import { paymentIdempotencyKeyForLock } from "./constants";

function fail(
  code: Extract<BookingPaymentLockResult, { ok: false }>["code"],
  message: string,
  status: number,
): BookingPaymentLockResult {
  return { ok: false, code, message, status };
}

function isScheduleInPast(scheduledStart: string): boolean {
  return new Date(scheduledStart).getTime() < Date.now();
}

export async function createBookingPaymentLock(
  user: CurrentUser,
  input: BookingLockInput,
): Promise<BookingPaymentLockResult> {
  if (user.role !== "customer") {
    return fail("FORBIDDEN", "Only customers can lock a booking for checkout.", 403);
  }

  const key = input.checkoutIdempotencyKey?.trim();
  if (!key) {
    return fail("INVALID_PAYLOAD", "checkoutIdempotencyKey is required.", 400);
  }

  if (!Number.isFinite(input.clientQuoteTotalCents) || input.clientQuoteTotalCents <= 0) {
    return fail("INVALID_PAYLOAD", "clientQuoteTotalCents must be a positive number.", 400);
  }

  if (isScheduleInPast(input.scheduledStart)) {
    return fail("INVALID_SCHEDULE", "Cannot lock a booking in the past.", 400);
  }

  const userClient = await createSupabaseServerClient();
  if (!userClient) {
    return fail("INVALID_PAYLOAD", "Supabase is not configured.", 503);
  }

  const ctx: BookingCommandRunContext = await resolveActorScope(
    userClient,
    user.profileId,
    user.role,
  );

  if (!ctx.actingCustomerId) {
    return fail("FORBIDDEN", "Customer profile is not linked.", 403);
  }

  const cleanerCheck = await validateCleanerPreferenceForLock(input);
  if (!cleanerCheck.ok) {
    return fail("CLEANER_INELIGIBLE", cleanerCheck.message, 422);
  }

  const quoteResult = calculateQuote(input.pricingInput);
  if (!quoteResult.ok) {
    return fail("QUOTE_MISMATCH", quoteResult.message, 422);
  }

  const serverTotal = quoteResult.breakdown.totalCents;
  if (serverTotal !== input.clientQuoteTotalCents) {
    return fail(
      "QUOTE_MISMATCH",
      `Quote changed: server total is ${serverTotal} cents but client sent ${input.clientQuoteTotalCents}. Refresh your quote on the review step.`,
      409,
    );
  }

  const serviceClient = requireServiceRoleClient();
  const inputsHash = hashLockInputs(input);
  const existing = await findLockByIdempotencyKey(serviceClient, key);

  if (existing) {
    if (existing.customer_id !== ctx.actingCustomerId) {
      return fail("FORBIDDEN", "Idempotency key belongs to another customer.", 403);
    }

    if (isLockExpired(existing)) {
      if (existing.status === "active") {
        await markLockExpired(serviceClient, existing.id);
      }
      return fail(
        "LOCK_EXPIRED",
        "Checkout session expired. Return to review and try again.",
        410,
      );
    }

    if (existing.inputs_hash !== inputsHash) {
      return fail(
        "LOCK_INPUT_MISMATCH",
        "Checkout details changed since the last lock. Return to review and refresh your quote.",
        409,
      );
    }

    const booking = await createBookingCommandBackend().getBooking(existing.booking_id);
    if (!booking) {
      return fail("PERSISTENCE_ERROR", "Locked booking row missing.", 500);
    }

    if (booking.price_cents !== existing.locked_price_cents) {
      return fail("QUOTE_MISMATCH", "Locked booking price is inconsistent.", 500);
    }

    return {
      ok: true,
      lockId: existing.id,
      bookingId: existing.booking_id,
      lockedPriceCents: existing.locked_price_cents,
      currency: existing.locked_currency,
      expiresAt: existing.expires_at,
      paymentIdempotencyKey: paymentIdempotencyKeyForLock(key),
      idempotent: true,
    };
  }

  const backend = createBookingCommandBackend();
  const actor = { actorType: "customer" as const, profileId: user.profileId };

  const draft = await executeBookingCommand(
    backend,
    {
      type: "CREATE_BOOKING_DRAFT",
      actor,
      customerId: ctx.actingCustomerId,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      priceCents: serverTotal,
      currency: quoteResult.breakdown.currency,
      metadata: {
        ...input.bookingMetadata,
        paymentLock: {
          checkoutIdempotencyKey: key,
          lockedAt: new Date().toISOString(),
        },
      },
    },
    ctx,
  );

  if (!draft.ok) {
    return fail(
      draft.code === "FORBIDDEN" ? "FORBIDDEN" : "PERSISTENCE_ERROR",
      draft.message,
      draft.code === "FORBIDDEN" ? 403 : 500,
    );
  }

  try {
    const lock = await insertBookingLock(serviceClient, {
      bookingId: draft.bookingId,
      customerId: ctx.actingCustomerId,
      input,
      lockedPriceCents: serverTotal,
      currency: quoteResult.breakdown.currency,
      lockedMetadata: input.bookingMetadata,
    });

    return {
      ok: true,
      lockId: lock.id,
      bookingId: draft.bookingId,
      lockedPriceCents: lock.locked_price_cents,
      currency: lock.locked_currency,
      expiresAt: lock.expires_at,
      paymentIdempotencyKey: paymentIdempotencyKeyForLock(key),
      idempotent: false,
    };
  } catch (e) {
    return fail(
      "PERSISTENCE_ERROR",
      e instanceof Error ? e.message : "Could not create booking lock.",
      500,
    );
  }
}
