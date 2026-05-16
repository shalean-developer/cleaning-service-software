import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "@/lib/auth/types";
import { verifyPayment } from "./verifyPayment";
import {
  applyPaystackUnitTestEnv,
  restorePaystackTestEnv,
  snapshotPaystackTestEnv,
} from "@/test/paystackTestEnv";

const paystackEnvSnapshot = snapshotPaystackTestEnv();

const paystackVerifyTransactionMock = vi.fn();
const processPaystackChargeSuccessMock = vi.fn();
const findPaymentByProviderRefMock = vi.fn();
const resolveActorScopeMock = vi.fn();
const createSupabaseServerClientMock = vi.fn();
const requireServiceRoleClientMock = vi.fn();

vi.mock("./paystackClient", () => ({
  paystackVerifyTransaction: (...args: unknown[]) => paystackVerifyTransactionMock(...args),
}));

vi.mock("./upsertBookingFromPaystack", () => ({
  processPaystackChargeSuccess: (...args: unknown[]) =>
    processPaystackChargeSuccessMock(...args),
}));

vi.mock("./paymentRepository", () => ({
  findPaymentByProviderRef: (...args: unknown[]) => findPaymentByProviderRefMock(...args),
}));

vi.mock("@/lib/auth/resolveActorScope", () => ({
  resolveActorScope: (...args: unknown[]) => resolveActorScopeMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => createSupabaseServerClientMock(),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => requireServiceRoleClientMock(),
}));

describe("verifyPayment", () => {
  const customerUser: CurrentUser = {
    profileId: "profile-1",
    role: "customer",
    authUser: { id: "auth-1", email: "cust@example.com" } as CurrentUser["authUser"],
  };

  beforeEach(() => {
    applyPaystackUnitTestEnv();
    createSupabaseServerClientMock.mockResolvedValue({});
    requireServiceRoleClientMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { customer_id: "customer-a" },
              error: null,
            }),
          }),
        }),
      }),
    });
    resolveActorScopeMock.mockResolvedValue({ actingCustomerId: "customer-a" });
    findPaymentByProviderRefMock.mockResolvedValue({
      id: "pay-1",
      booking_id: "booking-1",
    });
    paystackVerifyTransactionMock.mockResolvedValue({
      data: { id: 1, status: "success", reference: "ref_ok", amount: 1000 },
    });
    processPaystackChargeSuccessMock.mockResolvedValue({
      ok: true,
      bookingId: "booking-1",
      status: "confirmed",
      idempotent: true,
      paymentEvent: "duplicate",
      recoveredFromAlreadyFinalized: true,
    });
  });

  afterEach(() => {
    restorePaystackTestEnv(paystackEnvSnapshot);
    vi.clearAllMocks();
  });

  it("returns paid success when finalize recovers from already-finalized state", async () => {
    const result = await verifyPayment(customerUser, "ref_ok");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paid).toBe(true);
      expect(result.bookingId).toBe("booking-1");
      expect(result.idempotent).toBe(true);
      expect(result.recoveredFromAlreadyFinalized).toBe(true);
    }
  });

  it("rejects wrong customer before calling Paystack finalize", async () => {
    requireServiceRoleClientMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { customer_id: "customer-b" },
              error: null,
            }),
          }),
        }),
      }),
    });

    const result = await verifyPayment(customerUser, "ref_other");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("FORBIDDEN");
    }
    expect(paystackVerifyTransactionMock).not.toHaveBeenCalled();
    expect(processPaystackChargeSuccessMock).not.toHaveBeenCalled();
  });

  it("returns unpaid without error when Paystack charge is not successful", async () => {
    paystackVerifyTransactionMock.mockResolvedValue({
      data: { id: 2, status: "failed", reference: "ref_fail", amount: 1000 },
    });

    const result = await verifyPayment(customerUser, "ref_fail");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.paid).toBe(false);
      expect(result.bookingId).toBe("");
    }
    expect(processPaystackChargeSuccessMock).not.toHaveBeenCalled();
  });
});
