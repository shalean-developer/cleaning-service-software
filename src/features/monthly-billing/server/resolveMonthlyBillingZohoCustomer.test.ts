import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveMonthlyBillingZohoCustomer } from "./resolveMonthlyBillingZohoCustomer";

vi.mock("@/lib/zoho/zohoEnv", () => ({
  isZohoBooksEnabled: vi.fn(),
}));

vi.mock("@/lib/zoho/customers", () => ({
  findOrCreateZohoCustomer: vi.fn(),
}));

describe("resolveMonthlyBillingZohoCustomer", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses provided zohoCustomerId", async () => {
    const result = await resolveMonthlyBillingZohoCustomer({
      billingEmail: "a@example.com",
      zohoCustomerId: "123456789",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.zohoCustomerId).toBe("123456789");
      expect(result.created).toBe(false);
    }
  });

  it("returns error when create requested but Zoho unavailable", async () => {
    const { isZohoBooksEnabled } = await import("@/lib/zoho/zohoEnv");
    vi.mocked(isZohoBooksEnabled).mockReturnValueOnce(false);

    const result = await resolveMonthlyBillingZohoCustomer({
      billingEmail: "a@example.com",
      createZohoCustomer: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("ZOHO_UNAVAILABLE");
  });

  it("calls findOrCreateZohoCustomer when create requested", async () => {
    const { isZohoBooksEnabled } = await import("@/lib/zoho/zohoEnv");
    const { findOrCreateZohoCustomer } = await import("@/lib/zoho/customers");
    vi.mocked(isZohoBooksEnabled).mockReturnValueOnce(true);
    vi.mocked(findOrCreateZohoCustomer).mockResolvedValueOnce({
      ok: true,
      customerId: "zoho-new",
      contactName: "Acme",
    });

    const result = await resolveMonthlyBillingZohoCustomer({
      billingEmail: "a@example.com",
      displayName: "Acme",
      createZohoCustomer: true,
    });

    expect(result.ok).toBe(true);
    expect(findOrCreateZohoCustomer).toHaveBeenCalledWith({
      email: "a@example.com",
      displayName: "Acme",
    });
  });
});
