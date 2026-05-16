/** Default cleaner offer TTL after payment. */
export const ASSIGNMENT_OFFER_TTL_HOURS = 48;

/** Max rows processed per cron invocation of expireStaleAssignmentOffers. */
export const EXPIRE_OFFERS_BATCH_SIZE = 100;

/**
 * Cap total dispatch offers per booking (initial + redispatch) to avoid infinite loops.
 * Policy gap: selected-cleaner bookings do not auto-redispatch; this limits best_available retries.
 */
export const ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING = 5;

export const ASSIGNMENT_POST_PAYMENT_IDEMPOTENCY_PREFIX = "assignment:post_payment:";
