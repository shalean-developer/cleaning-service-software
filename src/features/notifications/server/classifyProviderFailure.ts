import "server-only";

/**
 * Maps provider error text to row retry eligibility.
 * Failover and structured failure kinds are deferred to Stage 5J-2+.
 */
export function classifyProviderFailure(message: string): { retryable: boolean } {
  const lower = message.toLowerCase();
  if (lower.includes("rate limit") || lower.includes("timeout") || lower.includes("503")) {
    return { retryable: true };
  }
  if (lower.includes("invalid") && lower.includes("email")) {
    return { retryable: false };
  }
  if (lower.includes("not verified") || lower.includes("domain")) {
    return { retryable: false };
  }
  return { retryable: true };
}
