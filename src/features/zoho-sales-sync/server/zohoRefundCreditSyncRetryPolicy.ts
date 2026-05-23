import "server-only";

export const MAX_ZOHO_REFUND_CREDIT_SYNC_ATTEMPTS = 5;
export const DEFAULT_ZOHO_REFUND_CREDIT_SYNC_BATCH_LIMIT = 25;

/** Backoff after failed attempt N (1-indexed). attempt 5+ is exhausted. */
export const ZOHO_REFUND_CREDIT_SYNC_BACKOFF_MS: readonly number[] = [
  5 * 60 * 1000,
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
];

export function computeNextRefundCreditSyncAttemptAt(
  attemptCountAfterFailure: number,
  fromMs: number = Date.now(),
): string | null {
  if (attemptCountAfterFailure >= MAX_ZOHO_REFUND_CREDIT_SYNC_ATTEMPTS) {
    return null;
  }

  const backoffMs = ZOHO_REFUND_CREDIT_SYNC_BACKOFF_MS[attemptCountAfterFailure - 1];
  if (backoffMs == null) {
    return null;
  }

  return new Date(fromMs + backoffMs).toISOString();
}

export function shouldExhaustRefundCreditSyncAttempts(attemptCountAfterFailure: number): boolean {
  return attemptCountAfterFailure >= MAX_ZOHO_REFUND_CREDIT_SYNC_ATTEMPTS;
}
