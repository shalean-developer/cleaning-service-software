import { describe, expect, it } from "vitest";
import {
  computeNextReconcileAttemptAt,
  MAX_ZOHO_RECONCILE_ATTEMPTS,
  shouldExhaustReconcileAttempts,
  ZOHO_RECONCILE_BACKOFF_MS,
} from "./zohoInvoiceReconcileRetryPolicy";

describe("zohoInvoiceReconcileRetryPolicy", () => {
  it("uses expected backoff schedule", () => {
    expect(ZOHO_RECONCILE_BACKOFF_MS).toEqual([
      5 * 60 * 1000,
      15 * 60 * 1000,
      60 * 60 * 1000,
      6 * 60 * 60 * 1000,
    ]);
  });

  it("computes next attempt timestamps from attempt count", () => {
    const base = Date.parse("2026-01-01T12:00:00.000Z");
    expect(computeNextReconcileAttemptAt(1, base)).toBe("2026-01-01T12:05:00.000Z");
    expect(computeNextReconcileAttemptAt(2, base)).toBe("2026-01-01T12:15:00.000Z");
    expect(computeNextReconcileAttemptAt(3, base)).toBe("2026-01-01T13:00:00.000Z");
    expect(computeNextReconcileAttemptAt(4, base)).toBe("2026-01-01T18:00:00.000Z");
    expect(computeNextReconcileAttemptAt(5, base)).toBeNull();
  });

  it("marks attempts exhausted at max", () => {
    expect(shouldExhaustReconcileAttempts(MAX_ZOHO_RECONCILE_ATTEMPTS)).toBe(true);
    expect(shouldExhaustReconcileAttempts(MAX_ZOHO_RECONCILE_ATTEMPTS - 1)).toBe(false);
  });
});
