import { afterEach, describe, expect, it, vi } from "vitest";
import { enableCustomerMonthlyBillingAccount } from "./enableCustomerMonthlyBillingAccountFacade";

vi.mock("@/lib/app/zohoMonthlyAccountBillingFlag", () => ({
  isZohoMonthlyAccountBillingEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: vi.fn(),
}));

vi.mock("./resolveMonthlyBillingZohoCustomer", () => ({
  resolveMonthlyBillingZohoCustomer: vi.fn(),
}));

vi.mock("./customerBillingAccountWriteRepository", () => ({
  assertCustomerExists: vi.fn(),
  loadCustomerDisplayName: vi.fn(),
  upsertEnabledMonthlyBillingAccount: vi.fn(),
  accountAuditSnapshot: vi.fn(() => null),
}));

vi.mock("./customerBillingAccountRepository", () => ({
  getCustomerBillingAccount: vi.fn(),
}));

vi.mock("./customerBillingAccountIdempotency", () => ({
  findCustomerBillingAccountIdempotency: vi.fn(),
  storeCustomerBillingAccountIdempotency: vi.fn(),
  buildIdempotencyStoredResult: vi.fn(),
}));

vi.mock("./recordCustomerBillingAccountAudit", () => ({
  recordCustomerBillingAccountAudit: vi.fn(),
}));

const admin = {
  authUser: {} as never,
  profileId: "admin-profile-1",
  role: "admin" as const,
};

describe("enableCustomerMonthlyBillingAccount facade", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects when feature flag disabled", async () => {
    const { isZohoMonthlyAccountBillingEnabled } = await import(
      "@/lib/app/zohoMonthlyAccountBillingFlag"
    );
    vi.mocked(isZohoMonthlyAccountBillingEnabled).mockReturnValueOnce(false);

    const result = await enableCustomerMonthlyBillingAccount({
      admin,
      customerId: "11111111-1111-4111-8111-111111111111",
      billingEmail: "billing@example.com",
      billingTerms: "Net 30",
      approvalReason: "Approved by finance",
      idempotencyKey: "enable-key-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FEATURE_DISABLED");
    }
  });

  it("rejects missing approval reason", async () => {
    const result = await enableCustomerMonthlyBillingAccount({
      admin,
      customerId: "11111111-1111-4111-8111-111111111111",
      billingEmail: "billing@example.com",
      billingTerms: "Net 30",
      approvalReason: "  ",
      idempotencyKey: "enable-key-2",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_PAYLOAD");
  });

  it("enables with provided zohoCustomerId", async () => {
    const { requireServiceRoleClient } = await import("@/lib/supabase/serviceRole");
    const { resolveMonthlyBillingZohoCustomer } = await import("./resolveMonthlyBillingZohoCustomer");
    const { assertCustomerExists, upsertEnabledMonthlyBillingAccount } = await import(
      "./customerBillingAccountWriteRepository"
    );
    const { findCustomerBillingAccountIdempotency } = await import(
      "./customerBillingAccountIdempotency"
    );
    const { getCustomerBillingAccount } = await import("./customerBillingAccountRepository");

    vi.mocked(requireServiceRoleClient).mockReturnValue({} as never);
    vi.mocked(findCustomerBillingAccountIdempotency).mockResolvedValueOnce(null);
    vi.mocked(getCustomerBillingAccount).mockResolvedValueOnce(null);
    vi.mocked(assertCustomerExists).mockResolvedValueOnce(true);
    vi.mocked(resolveMonthlyBillingZohoCustomer).mockResolvedValueOnce({
      ok: true,
      zohoCustomerId: "zoho-123",
      zohoContactName: null,
      created: false,
    });
    vi.mocked(upsertEnabledMonthlyBillingAccount).mockResolvedValueOnce({
      id: "acc-1",
      customerId: "11111111-1111-4111-8111-111111111111",
      billingMode: "monthly_account",
      zohoCustomerId: "zoho-123",
      billingEmail: "billing@example.com",
      billingTerms: "Net 30",
      isMonthlyAccountEnabled: true,
      approvedByAdminId: "admin-profile-1",
      approvedAt: "2026-01-01T00:00:00.000Z",
      approvalReason: "Approved",
      disabledAt: null,
      disabledByAdminId: null,
      metadata: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await enableCustomerMonthlyBillingAccount({
      admin,
      customerId: "11111111-1111-4111-8111-111111111111",
      billingEmail: "billing@example.com",
      billingTerms: "Net 30",
      approvalReason: "Approved by finance",
      idempotencyKey: "enable-key-3",
      zohoCustomerId: "zoho-123",
    });

    expect(result.ok).toBe(true);
    expect(resolveMonthlyBillingZohoCustomer).toHaveBeenCalled();
  });
});
