import "server-only";

import type { BookingLockRow, BookingRow } from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { findLockById, isLockExpired, markLockExpired } from "./lockRepository";
import type { BookingLockErrorCode } from "./types";

export type AssertLockFailure = {
  ok: false;
  code: BookingLockErrorCode;
  message: string;
  status: number;
};

export type AssertLockSuccess = {
  ok: true;
  lock: BookingLockRow;
};

export async function assertActiveBookingLock(params: {
  lockId: string;
  bookingId: string;
  customerId: string;
}): Promise<AssertLockSuccess | AssertLockFailure> {
  const client = requireServiceRoleClient();
  const lock = await findLockById(client, params.lockId);

  if (!lock) {
    return {
      ok: false,
      code: "LOCK_NOT_FOUND",
      message: "Payment lock not found.",
      status: 404,
    };
  }

  if (lock.booking_id !== params.bookingId) {
    return {
      ok: false,
      code: "LOCK_NOT_ACTIVE",
      message: "Lock does not match this booking.",
      status: 400,
    };
  }

  if (lock.customer_id !== params.customerId) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: "Lock belongs to another customer.",
      status: 403,
    };
  }

  if (lock.status === "consumed") {
    return {
      ok: false,
      code: "LOCK_NOT_ACTIVE",
      message: "Payment lock was already used.",
      status: 409,
    };
  }

  if (isLockExpired(lock)) {
    if (lock.status === "active") {
      await markLockExpired(client, lock.id);
    }
    return {
      ok: false,
      code: "LOCK_EXPIRED",
      message: "Payment lock expired. Return to review and refresh your quote.",
      status: 410,
    };
  }

  if (lock.status !== "active") {
    return {
      ok: false,
      code: "LOCK_NOT_ACTIVE",
      message: "Payment lock is not active.",
      status: 400,
    };
  }

  return { ok: true, lock };
}

export function assertBookingMatchesLock(
  booking: BookingRow,
  lock: BookingLockRow,
): AssertLockFailure | null {
  if (booking.price_cents !== lock.locked_price_cents) {
    return {
      ok: false,
      code: "QUOTE_MISMATCH",
      message: "Booking price does not match locked quote.",
      status: 409,
    };
  }

  if (booking.currency !== lock.locked_currency) {
    return {
      ok: false,
      code: "QUOTE_MISMATCH",
      message: "Booking currency does not match locked quote.",
      status: 409,
    };
  }

  if (booking.scheduled_start !== lock.locked_schedule_start) {
    return {
      ok: false,
      code: "LOCK_INPUT_MISMATCH",
      message: "Booking schedule does not match lock.",
      status: 409,
    };
  }

  return null;
}
