import { describe, expect, it, vi } from "vitest";
import {
  REGISTER_CREDIT_CONFIRM_PHRASE,
  registerZohoRefundCredit,
} from "./registerZohoRefundCredit";

const gateMock = vi.fn();
const validateMock = vi.fn();
const contextMock = vi.fn();
const runPostMock = vi.fn();

vi.mock("./zohoRefundCreditSyncLaunchGuard", () => ({
  requireZohoRefundCreditSyncEnabled: () => gateMock(),
}));

vi.mock("./loadRefundCreditSource", () => ({
  validateRefundCreditAmount: (...args: unknown[]) => validateMock(...args),
  loadRefundCreditSourceContext: (...args: unknown[]) => contextMock(...args),
}));

vi.mock("./runPostRefundZohoCreditSync", () => ({
  runPostRefundZohoCreditSync: (...args: unknown[]) => runPostMock(...args),
}));

function clientMock(row: { id: string } | null) {
  return {
    from() {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: row, error: null }),
            }),
          }),
        }),
      };
    },
  };
}

describe("registerZohoRefundCredit", () => {
  it("requires REGISTER CREDIT confirmation phrase", async () => {
    gateMock.mockReturnValue({ ok: true });

    const result = await registerZohoRefundCredit(
      {
        sourceType: "booking_refund",
        sourceId: "booking-1",
        amountCents: 1000,
        reason: "Manual Paystack refund",
        confirmPhrase: "wrong",
        initiatedByAdminId: "admin-1",
      },
      clientMock(null) as never,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("CONFIRM_PHRASE_REQUIRED");
    }
  });

  it("requires reason", async () => {
    gateMock.mockReturnValue({ ok: true });

    const result = await registerZohoRefundCredit(
      {
        sourceType: "booking_refund",
        sourceId: "booking-1",
        amountCents: 1000,
        reason: "  ",
        confirmPhrase: REGISTER_CREDIT_CONFIRM_PHRASE,
        initiatedByAdminId: "admin-1",
      },
      clientMock(null) as never,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("REASON_REQUIRED");
    }
  });

  it("rejects amount exceeding paid total", async () => {
    gateMock.mockReturnValue({ ok: true });
    validateMock.mockResolvedValue({
      ok: false,
      code: "AMOUNT_EXCEEDS_PAID",
      message: "Refund amount exceeds original paid amount.",
    });

    const result = await registerZohoRefundCredit(
      {
        sourceType: "booking_refund",
        sourceId: "booking-1",
        amountCents: 999999,
        reason: "Over refund",
        confirmPhrase: REGISTER_CREDIT_CONFIRM_PHRASE,
        initiatedByAdminId: "admin-1",
      },
      clientMock(null) as never,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AMOUNT_EXCEEDS_PAID");
    }
  });
});
