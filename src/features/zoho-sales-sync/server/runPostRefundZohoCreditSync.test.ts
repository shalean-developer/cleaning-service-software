import { describe, expect, it, vi } from "vitest";
import { runPostRefundZohoCreditSync, runPostBookingCancellationZohoCreditSync } from "./runPostRefundZohoCreditSync";

const enabledMock = vi.fn();
const enqueueMock = vi.fn();
const syncMock = vi.fn();
const salesSyncMock = vi.fn();

vi.mock("./zohoRefundCreditSyncLaunchGuard", () => ({
  isZohoRefundCreditSyncEnabled: () => enabledMock(),
}));

vi.mock("./zohoRefundCreditSyncRepository", () => ({
  enqueueZohoRefundCreditSync: (...args: unknown[]) => enqueueMock(...args),
}));

vi.mock("./syncZohoRefundCreditToZoho", () => ({
  syncZohoRefundCreditToZoho: (...args: unknown[]) => syncMock(...args),
}));

vi.mock("./zohoSalesSyncRepository", () => ({
  findZohoSalesSyncBySource: (...args: unknown[]) => salesSyncMock(...args),
}));

function clientMock(payment: unknown) {
  return {
    from(table: string) {
      if (table !== "payments") throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: payment, error: null }),
                }),
              }),
            }),
          }),
        }),
      };
    },
  };
}

describe("runPostRefundZohoCreditSync", () => {
  it("does nothing when feature flag is off", async () => {
    enabledMock.mockReturnValue(false);
    await runPostRefundZohoCreditSync({} as never, {
      sourceType: "booking_refund",
      sourceId: "source-1",
      amountCents: 1000,
      reason: "test",
    });
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("does not enqueue without Zoho accounting context", async () => {
    enabledMock.mockReturnValue(true);
    salesSyncMock.mockResolvedValue(null);

    await runPostRefundZohoCreditSync({} as never, {
      sourceType: "booking_refund",
      sourceId: "booking-1",
      bookingId: "booking-1",
      amountCents: 1000,
      reason: "test",
    });

    expect(enqueueMock).not.toHaveBeenCalled();
  });
});

describe("runPostBookingCancellationZohoCreditSync", () => {
  it("does not enqueue for unpaid booking", async () => {
    enabledMock.mockReturnValue(true);
    await runPostBookingCancellationZohoCreditSync(clientMock(null) as never, {
      bookingId: "booking-1",
    });
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("enqueues credit sync for paid booking with Zoho context", async () => {
    enabledMock.mockReturnValue(true);
    salesSyncMock.mockResolvedValue({
      zoho_invoice_id: "inv-1",
      invoice_number: "INV-001",
    });
    enqueueMock.mockResolvedValue({ id: "sync-1", source_id: "booking-1" });
    syncMock.mockResolvedValue({ ok: true, syncStatus: "synced", syncId: "sync-1" });

    await runPostBookingCancellationZohoCreditSync(
      clientMock({
        amount_cents: 5000,
        currency: "ZAR",
        provider_ref: "pay-ref",
        status: "paid",
      }) as never,
      { bookingId: "booking-1" },
    );

    expect(enqueueMock).toHaveBeenCalled();
  });
});
