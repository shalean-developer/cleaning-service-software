/** Paystack checkout / lock TTL (minutes). */
export const BOOKING_LOCK_TTL_MINUTES = 30;

export const BOOKING_LOCK_TIMEZONE = "Africa/Johannesburg";

export function isBookingLockRequired(): boolean {
  const flag = process.env.BOOKING_LOCK_REQUIRED?.trim().toLowerCase();
  if (flag === "false") return false;
  return true;
}

export function paymentIdempotencyKeyForLock(idempotencyKey: string): string {
  return `paystack:checkout:${idempotencyKey}`;
}
