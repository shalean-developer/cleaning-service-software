import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CustomerBillingAccount } from "@/features/monthly-billing/server/monthlyBillingTypes";

const hoisted = vi.hoisted(() => ({
  account: null as CustomerBillingAccount | null,
  featureEnabled: true,
}));

vi.mock("@/lib/app/zohoMonthlyAccountBillingFlag", () => ({
  isZohoMonthlyAccountBillingEnabled: () => hoisted.featureEnabled,
}));

vi.mock("@/features/monthly-billing/server/customerBillingAccountRepository", () => ({
  getCustomerBillingAccount: async () => hoisted.account,
}));

import { validateAdminWizardBillingMode } from "./validateAdminWizardBillingMode";

const customerId = "11111111-1111-4111-8111-111111111111";
const accountId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const approvedAccount: CustomerBillingAccount = {
  id: accountId,
  customerId,
  billingMode: "monthly_account",
  zohoCustomerId: "zoho-123",
  billingEmail: "billing@example.com",
  billingTerms: "Net 30",
  isMonthlyAccountEnabled: true,
  approvedByAdminId: "admin-profile-1",
  approvedAt: "2026-01-01T00:00:00.000Z",
  approvalReason: "Trusted client",
  disabledAt: null,
  disabledByAdminId: null,
  metadata: {},
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("validateAdminWizardBillingMode", () => {
  beforeEach(() => {
    hoisted.account = approvedAccount;
    hoisted.featureEnabled = true;
  });

  afterEach(() => {
    hoisted.account = null;
    hoisted.featureEnabled = true;
  });

  it("accepts paystack_link without billing account lookup requirements", async () => {
    hoisted.account = null;
    const result = await validateAdminWizardBillingMode({
      customerId,
      adminProfileId: "admin-profile-1",
      billing: { mode: "paystack_link" },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.billing.mode).toBe("paystack_link");
    expect(result.billing.source).toBe("admin_wizard");
  });

  it("rejects monthly_account when feature flag off", async () => {
    hoisted.featureEnabled = false;
    const result = await validateAdminWizardBillingMode({
      customerId,
      adminProfileId: "admin-profile-1",
      billing: {
        mode: "monthly_account",
        monthlyAccountId: accountId,
        zohoCustomerId: "zoho-123",
        billingEmail: "billing@example.com",
        billingTerms: "Net 30",
      },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects monthly_account when customer not approved", async () => {
    hoisted.account = { ...approvedAccount, approvedAt: null, approvedByAdminId: null };
    const result = await validateAdminWizardBillingMode({
      customerId,
      adminProfileId: "admin-profile-1",
      billing: {
        mode: "monthly_account",
        monthlyAccountId: accountId,
        zohoCustomerId: "zoho-123",
        billingEmail: "billing@example.com",
        billingTerms: "Net 30",
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("not approved");
  });

  it("rejects monthly_account when account customer mismatch", async () => {
    hoisted.account = { ...approvedAccount, customerId: "22222222-2222-4222-8222-222222222222" };
    const result = await validateAdminWizardBillingMode({
      customerId,
      adminProfileId: "admin-profile-1",
      billing: {
        mode: "monthly_account",
        monthlyAccountId: accountId,
        zohoCustomerId: "zoho-123",
        billingEmail: "billing@example.com",
        billingTerms: "Net 30",
      },
    });
    expect(result.ok).toBe(false);
  });

  it("accepts monthly_account for approved customer and stores metadata fields", async () => {
    const result = await validateAdminWizardBillingMode({
      customerId,
      adminProfileId: "admin-profile-1",
      billing: {
        mode: "monthly_account",
        monthlyAccountId: accountId,
        zohoCustomerId: "zoho-123",
        billingEmail: "billing@example.com",
        billingTerms: "Net 30",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.billing.mode).toBe("monthly_account");
    expect(result.billing.monthlyAccountId).toBe(accountId);
    expect(result.billing.zohoCustomerId).toBe("zoho-123");
    expect(result.billing.configuredByAdminProfileId).toBe("admin-profile-1");
  });
});
