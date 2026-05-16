/** Grace after `payment_link_expires_at` before cron marks checkout abandoned. */
export const PENDING_PAYMENT_EXPIRY_GRACE_MINUTES = Number(
  process.env.PENDING_PAYMENT_EXPIRY_GRACE_MINUTES ?? 15,
);

/** Max stale pending payments processed per cron run. */
export const PENDING_PAYMENT_EXPIRE_BATCH_SIZE = Number(
  process.env.PENDING_PAYMENT_EXPIRE_BATCH_SIZE ?? 50,
);
