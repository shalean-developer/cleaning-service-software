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

/** Minimum time after paid payment before a confirmed booking is eligible for recovery. */
export const ASSIGNMENT_RECOVERY_GRACE_MINUTES = Number(
  process.env.ASSIGNMENT_RECOVERY_GRACE_MINUTES ?? 3,
);

/** Max bookings processed per recovery cron / ops batch. */
export const ASSIGNMENT_RECOVERY_BATCH_SIZE = 50;

/**
 * Grace after assignment_dispatch_at before a deferred booking is treated as overdue
 * (ops attention / dispatch_overdue phase). Defaults to 60 minutes for hourly cron slack.
 */
export const DEFERRED_DISPATCH_OVERDUE_GRACE_MINUTES = Number(
  process.env.DEFERRED_DISPATCH_OVERDUE_GRACE_MINUTES ?? 60,
);
