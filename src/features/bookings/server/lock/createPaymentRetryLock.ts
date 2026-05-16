import "server-only";

import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { createBookingCommandBackend } from "@/features/bookings/server/commands/runBookingCommand";
import type { CurrentUser } from "@/lib/auth/types";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  findActiveLockByBookingId,
  findLockByIdempotencyKey,
  insertBookingLock,
  isLockExpired,
  markLockExpired,
} from "./lockRepository";
import { parseRetryLockFromBooking } from "./parseRetryLockFromBooking";
import { validateCleanerPreferenceForLock } from "./validateCleanerPreference";
import type {
  BookingLockInput,
  PaymentRetryLockInput,
  PaymentRetryLockResult,
} from "./types";
import { paymentIdempotencyKeyForLock } from "./constants";

const RETRY_ELIGIBLE_STATUS: BookingStatus = "payment_failed";

function fail(
  code: Extract<PaymentRetryLockResult, { ok: false }>["code"],
  message: string,
  status: number,
): PaymentRetryLockResult {
  return { ok: false, code, message, status };
}

function successFromLock(
  lock: {
    id: string;
    booking_id: string;
    locked_price_cents: number;
    locked_currency: string;
    expires_at: string;
    idempotency_key: string;
  },
  idempotent: boolean,
): PaymentRetryLockResult {
  return {
    ok: true,
    lockId: lock.id,
    bookingId: lock.booking_id,
    lockedPriceCents: lock.locked_price_cents,
    currency: lock.locked_currency,
    expiresAt: lock.expires_at,
    paymentIdempotencyKey: paymentIdempotencyKeyForLock(lock.idempotency_key),
    idempotent,
  };
}

function isScheduleInPast(scheduledStart: string): boolean {
  return new Date(scheduledStart).getTime() < Date.now();
}

export async function createPaymentRetryLock(
  user: CurrentUser,
  bookingId: string,
  input: PaymentRetryLockInput,
): Promise<PaymentRetryLockResult> {
  if (user.role !== "customer") {
    return fail("FORBIDDEN", "Only customers can retry payment for a booking.", 403);
  }

  const key = input.checkoutIdempotencyKey?.trim();
  if (!key) {
    return fail("INVALID_PAYLOAD", "checkoutIdempotencyKey is required.", 400);
  }

  const userClient = await createSupabaseServerClient();
  if (!userClient) {
    return fail("INVALID_PAYLOAD", "Supabase is not configured.", 503);
  }

  const ctx = await resolveActorScope(userClient, user.profileId, user.role);
  if (!ctx.actingCustomerId) {
    return fail("PROVISIONING_INCOMPLETE", "Account setup is not complete.", 403);
  }

  const backend = createBookingCommandBackend();
  const booking = await backend.getBooking(bookingId);
  if (!booking) {
    return fail("BOOKING_NOT_FOUND", "Booking not found.", 404);
  }

  if (booking.customer_id !== ctx.actingCustomerId) {
    return fail("FORBIDDEN", "Cannot retry payment for another customer's booking.", 403);
  }

  if (booking.status !== RETRY_ELIGIBLE_STATUS) {
    return fail(
      "RETRY_NOT_ELIGIBLE",
      `Payment retry is only available for bookings with status "${RETRY_ELIGIBLE_STATUS}" (got "${booking.status}").`,
      409,
    );
  }

  if (await backend.hasPaidPaymentForBooking(booking.id)) {
    return fail(
      "RETRY_NOT_ELIGIBLE",
      "This booking already has a successful payment.",
      409,
    );
  }

  const parsed = parseRetryLockFromBooking(booking);
  if (!parsed.ok) {
    return fail("RETRY_NOT_SUPPORTED", parsed.message, 422);
  }

  if (isScheduleInPast(booking.scheduled_start)) {
    return fail(
      "INVALID_SCHEDULE",
      "Cannot retry payment for a booking scheduled in the past. Start a new booking.",
      410,
    );
  }

  const quoteResult = calculateQuote(parsed.pricingInput);
  if (!quoteResult.ok) {
    return fail("QUOTE_MISMATCH", quoteResult.message, 422);
  }

  if (quoteResult.breakdown.totalCents !== booking.price_cents) {
    return fail(
      "QUOTE_STALE",
      "The stored booking price no longer matches the current quote. Start a new booking to refresh pricing.",
      409,
    );
  }

  const lockInput: BookingLockInput = {
    checkoutIdempotencyKey: key,
    clientQuoteTotalCents: booking.price_cents,
    pricingInput: parsed.pricingInput,
    scheduledStart: booking.scheduled_start,
    scheduledEnd: booking.scheduled_end,
    areaSlug: parsed.areaSlug,
    cleanerPreference: parsed.cleanerPreference,
    bookingMetadata: parsed.bookingMetadata,
  };

  const cleanerCheck = await validateCleanerPreferenceForLock(lockInput);
  if (!cleanerCheck.ok) {
    return fail("CLEANER_INELIGIBLE", cleanerCheck.message, 422);
  }

  const serviceClient = requireServiceRoleClient();
  const existingByKey = await findLockByIdempotencyKey(serviceClient, key);

  if (existingByKey) {
    if (existingByKey.customer_id !== ctx.actingCustomerId) {
      return fail("FORBIDDEN", "Idempotency key belongs to another customer.", 403);
    }
    if (existingByKey.booking_id !== booking.id) {
      return fail(
        "INVALID_PAYLOAD",
        "checkoutIdempotencyKey is already used for a different booking.",
        409,
      );
    }

    if (isLockExpired(existingByKey)) {
      if (existingByKey.status === "active") {
        await markLockExpired(serviceClient, existingByKey.id);
      }
    } else if (existingByKey.status === "active") {
      if (booking.price_cents !== existingByKey.locked_price_cents) {
        return fail("QUOTE_MISMATCH", "Locked booking price is inconsistent.", 500);
      }
      return successFromLock(existingByKey, true);
    }
  }

  const activeOnBooking = await findActiveLockByBookingId(serviceClient, booking.id);
  if (activeOnBooking) {
    if (activeOnBooking.idempotency_key === key) {
      if (isLockExpired(activeOnBooking)) {
        await markLockExpired(serviceClient, activeOnBooking.id);
      } else {
        return successFromLock(activeOnBooking, true);
      }
    } else if (isLockExpired(activeOnBooking)) {
      await markLockExpired(serviceClient, activeOnBooking.id);
    } else {
      return fail(
        "ACTIVE_LOCK_EXISTS",
        "A checkout session is already open for this booking. Complete or wait for it to expire.",
        409,
      );
    }
  }

  try {
    const lock = await insertBookingLock(serviceClient, {
      bookingId: booking.id,
      customerId: ctx.actingCustomerId,
      input: lockInput,
      lockedPriceCents: booking.price_cents,
      currency: booking.currency,
      lockedMetadata: parsed.bookingMetadata,
    });

    return successFromLock(lock, false);
  } catch (e) {
    return fail(
      "PERSISTENCE_ERROR",
      e instanceof Error ? e.message : "Could not create payment retry lock.",
      500,
    );
  }
}
