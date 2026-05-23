import { describe, expect, it } from "vitest";
import {
  assertMonthlyAccountServiceAuthorizationAllowed,
  ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION,
} from "./assertMonthlyAccountServiceAuthorizationAllowed";
import type { CustomerBillingAccount } from "./monthlyBillingTypes";

function baseAccount(overrides: Partial<CustomerBillingAccount> = {}): CustomerBillingAccount {
  return {
    id: "acc-1",
    customerId: "cust-1",
    billingMode: "monthly_account",
    zohoCustomerId: null,
    billingEmail: "billing@example.com",
    billingTerms: "Net 30",
    isMonthlyAccountEnabled: true,
    approvedByAdminId: null,
    approvedAt: null,
    approvalReason: null,
    disabledAt: null,
    disabledByAdminId: null,
    governanceState: "approved",
    creditLimitCents: 100_000,
    manualOverrideUntil: null,
    suspendedAt: null,
    suspendedByAdminId: null,
    suspensionReason: null,
    lastFinanceReviewAt: null,
    lastFinanceReviewBy: null,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("assertMonthlyAccountServiceAuthorizationAllowed", () => {
  it("blocks suspended accounts", () => {
    const result = assertMonthlyAccountServiceAuthorizationAllowed({
      account: baseAccount({ governanceState: "suspended" }),
      exposure: {
        outstandingBalanceCents: 0,
        pendingExposureCents: 0,
        creditLimitCents: 100_000,
        disputedInvoiceCount: 0,
        overdueInvoiceCount: 0,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ACCOUNT_SUSPENDED_FOR_MONTHLY_AUTHORIZATION);
    }
  });

  it("requires elevated confirmation when exposure exceeded", () => {
    const result = assertMonthlyAccountServiceAuthorizationAllowed({
      account: baseAccount(),
      exposure: {
        outstandingBalanceCents: 120_000,
        pendingExposureCents: 0,
        creditLimitCents: 100_000,
        disputedInvoiceCount: 0,
        overdueInvoiceCount: 0,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ELEVATED_EXPOSURE_CONFIRMATION_REQUIRED");
  });

  it("allows exceeded exposure with confirmation", () => {
    const result = assertMonthlyAccountServiceAuthorizationAllowed({
      account: baseAccount(),
      exposure: {
        outstandingBalanceCents: 120_000,
        pendingExposureCents: 0,
        creditLimitCents: 100_000,
        disputedInvoiceCount: 0,
        overdueInvoiceCount: 0,
      },
      confirmElevatedExposure: true,
    });
    expect(result.ok).toBe(true);
  });

  it("override bypasses elevated confirmation but not suspension", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const allowed = assertMonthlyAccountServiceAuthorizationAllowed({
      account: baseAccount({ manualOverrideUntil: future }),
      exposure: {
        outstandingBalanceCents: 120_000,
        pendingExposureCents: 0,
        creditLimitCents: 100_000,
        disputedInvoiceCount: 0,
        overdueInvoiceCount: 0,
      },
    });
    expect(allowed.ok).toBe(true);

    const blocked = assertMonthlyAccountServiceAuthorizationAllowed({
      account: baseAccount({ governanceState: "suspended", manualOverrideUntil: future }),
      exposure: {
        outstandingBalanceCents: 0,
        pendingExposureCents: 0,
        creditLimitCents: 100_000,
        disputedInvoiceCount: 0,
        overdueInvoiceCount: 0,
      },
    });
    expect(blocked.ok).toBe(false);
  });
});
