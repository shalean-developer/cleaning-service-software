import { describe, expect, it } from "vitest";
import { computeMonthlyAccountExposure } from "./computeMonthlyAccountExposure";

describe("computeMonthlyAccountExposure", () => {
  it("calculates exceeded exposure against credit limit", () => {
    const result = computeMonthlyAccountExposure({
      outstandingBalanceCents: 80_000,
      pendingExposureCents: 30_000,
      creditLimitCents: 100_000,
      disputedInvoiceCount: 0,
      overdueInvoiceCount: 0,
    });
    expect(result.totalExposureCents).toBe(110_000);
    expect(result.exposurePercent).toBe(110);
    expect(result.exposureBand).toBe("exceeded");
    expect(result.recommendation).toBe("manual_override_required");
  });

  it("reflects lower exposure when outstanding balance drops after payment", () => {
    const unpaid = computeMonthlyAccountExposure({
      outstandingBalanceCents: 50_000,
      pendingExposureCents: 0,
      creditLimitCents: 100_000,
      disputedInvoiceCount: 0,
      overdueInvoiceCount: 1,
    });
    const paid = computeMonthlyAccountExposure({
      outstandingBalanceCents: 0,
      pendingExposureCents: 0,
      creditLimitCents: 100_000,
      disputedInvoiceCount: 0,
      overdueInvoiceCount: 0,
    });
    expect(unpaid.totalExposureCents).toBeGreaterThan(paid.totalExposureCents);
    expect(paid.exposureBand).toBe("healthy");
  });

  it("defaults governance state to approved behavior", () => {
    const result = computeMonthlyAccountExposure({
      outstandingBalanceCents: 0,
      pendingExposureCents: 0,
      creditLimitCents: null,
      disputedInvoiceCount: 0,
      overdueInvoiceCount: 0,
      governanceState: "approved",
    });
    expect(result.exposureBand).toBe("healthy");
    expect(result.recommendation).toBe("continue_normal");
  });
});
