import { beforeEach, describe, expect, it, vi } from "vitest";
import { revokeCustomerPaymentMethod } from "./revokeCustomerPaymentMethod";
import { revokeAdminPaymentMethod } from "./revokeAdminPaymentMethod";

const revokeByCustomerMock = vi.fn();
const revokeByAdminMock = vi.fn();

vi.mock("./zohoInvoicePaymentMethodRepository", () => ({
  revokePaymentMethodByCustomer: (...args: unknown[]) => revokeByCustomerMock(...args),
  revokePaymentMethodByAdmin: (...args: unknown[]) => revokeByAdminMock(...args),
}));

vi.mock("@/lib/zoho/zohoInvoicePaymentLogger", () => ({
  logZohoInvoicePaymentEvent: vi.fn(),
}));

describe("revokeCustomerPaymentMethod service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns forbidden when repository rejects", async () => {
    revokeByCustomerMock.mockResolvedValue({
      ok: false,
      code: "FORBIDDEN",
      message: "You cannot revoke this payment method.",
    });

    const result = await revokeCustomerPaymentMethod({
      paymentMethodId: "method-1",
      customerEmail: "jane@example.com",
      actorProfileId: "profile-1",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(403);
  });

  it("returns success when repository revokes", async () => {
    revokeByCustomerMock.mockResolvedValue({
      ok: true,
      idempotent: false,
      paymentMethodId: "method-1",
    });

    const result = await revokeCustomerPaymentMethod({
      paymentMethodId: "method-1",
      customerEmail: "jane@example.com",
      actorProfileId: "profile-1",
      reason: "No longer needed",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.paymentMethodId).toBe("method-1");
  });
});

describe("revokeAdminPaymentMethod service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid confirm phrase", async () => {
    const result = await revokeAdminPaymentMethod({
      paymentMethodId: "method-1",
      adminProfileId: "admin-1",
      reason: "Customer requested via support ticket",
      confirmPhrase: "WRONG",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_CONFIRM_PHRASE");
  });

  it("rejects short reason", async () => {
    const result = await revokeAdminPaymentMethod({
      paymentMethodId: "method-1",
      adminProfileId: "admin-1",
      reason: "short",
      confirmPhrase: "REVOKE PAYMENT METHOD",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_REASON");
  });

  it("delegates to repository when valid", async () => {
    revokeByAdminMock.mockResolvedValue({
      ok: true,
      idempotent: false,
      paymentMethodId: "method-1",
    });

    const result = await revokeAdminPaymentMethod({
      paymentMethodId: "method-1",
      adminProfileId: "admin-1",
      reason: "Customer requested removal via support",
      confirmPhrase: "REVOKE PAYMENT METHOD",
    });

    expect(result.ok).toBe(true);
    expect(revokeByAdminMock).toHaveBeenCalled();
  });
});
