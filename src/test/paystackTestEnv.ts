/** Deterministic Paystack credentials for unit tests (isolated from .env.local). */
export const PAYSTACK_UNIT_TEST_SECRET = "sk_test_unit_secret";

const PAYSTACK_TEST_ENV_KEYS = [
  "PAYSTACK_SECRET_KEY",
  "PAYSTACK_WEBHOOK_SECRET",
  "PAYSTACK_ENABLED",
] as const;

export type PaystackTestEnvSnapshot = Partial<
  Record<(typeof PAYSTACK_TEST_ENV_KEYS)[number], string | undefined>
>;

export function snapshotPaystackTestEnv(): PaystackTestEnvSnapshot {
  return {
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET,
    PAYSTACK_ENABLED: process.env.PAYSTACK_ENABLED,
  };
}

/** Apply fixed unit-test Paystack env (overrides .env.local for the current test). */
export function applyPaystackUnitTestEnv(): void {
  process.env.PAYSTACK_SECRET_KEY = PAYSTACK_UNIT_TEST_SECRET;
  process.env.PAYSTACK_WEBHOOK_SECRET = PAYSTACK_UNIT_TEST_SECRET;
  process.env.PAYSTACK_ENABLED = "true";
}

export function restorePaystackTestEnv(snapshot: PaystackTestEnvSnapshot): void {
  for (const key of PAYSTACK_TEST_ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/**
 * Returns a restore function — useful in beforeEach/afterEach pairs.
 */
export function withPaystackTestEnv(): () => void {
  const snapshot = snapshotPaystackTestEnv();
  applyPaystackUnitTestEnv();
  return () => restorePaystackTestEnv(snapshot);
}
