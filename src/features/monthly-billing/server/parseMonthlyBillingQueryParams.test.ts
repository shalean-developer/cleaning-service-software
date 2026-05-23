import { describe, expect, it } from "vitest";
import {
  MonthlyBillingValidationError,
  parseMonthlyBillingAccountsQuery,
  parseMonthlyBillingBatchesQuery,
} from "./parseMonthlyBillingQueryParams";

describe("parseMonthlyBillingQueryParams", () => {
  it("parses valid accounts query params", () => {
    const params = parseMonthlyBillingAccountsQuery(
      new URLSearchParams("status=enabled&mode=monthly_account&limit=50"),
    );
    expect(params.status).toBe("enabled");
    expect(params.mode).toBe("monthly_account");
    expect(params.limit).toBe(50);
  });

  it("rejects invalid accounts status", () => {
    expect(() =>
      parseMonthlyBillingAccountsQuery(new URLSearchParams("status=maybe")),
    ).toThrow(MonthlyBillingValidationError);
  });

  it("parses valid batches query params", () => {
    const customerId = "11111111-1111-4111-8111-111111111111";
    const params = parseMonthlyBillingBatchesQuery(
      new URLSearchParams(`customerId=${customerId}&status=draft&billingMonth=2026-05-01`),
    );
    expect(params.customerId).toBe(customerId);
    expect(params.status).toBe("draft");
    expect(params.billingMonth).toBe("2026-05-01");
  });

  it("rejects invalid customer UUID", () => {
    expect(() =>
      parseMonthlyBillingBatchesQuery(new URLSearchParams("customerId=not-a-uuid")),
    ).toThrow(MonthlyBillingValidationError);
  });
});
