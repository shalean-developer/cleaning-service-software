import { describe, expect, it, vi } from "vitest";
import { runPostPaymentZohoSalesSync } from "./runPostPaymentZohoSalesSync";

const enabledMock = vi.fn();
const enqueueMock = vi.fn();
const syncMock = vi.fn();

vi.mock("./zohoSalesSyncLaunchGuard", () => ({
  isZohoSalesSyncEnabled: () => enabledMock(),
}));

vi.mock("./zohoSalesSyncRepository", () => ({
  enqueueZohoSalesSync: (...args: unknown[]) => enqueueMock(...args),
}));

vi.mock("./syncShaleanSaleToZoho", () => ({
  syncShaleanSaleToZoho: (...args: unknown[]) => syncMock(...args),
}));

describe("runPostPaymentZohoSalesSync", () => {
  it("does nothing when feature flag is off", async () => {
    enabledMock.mockReturnValue(false);
    await runPostPaymentZohoSalesSync({} as never, { id: "booking-1", currency: "ZAR" } as never, {
      paymentId: "pay-1",
      charge: { amountCents: 1000, reference: "ref-1" } as never,
    });
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("enqueues booking sync without throwing when sync fails", async () => {
    enabledMock.mockReturnValue(true);
    enqueueMock.mockResolvedValue({ source_id: "booking-1" });
    syncMock.mockRejectedValue(new Error("zoho down"));

    await expect(
      runPostPaymentZohoSalesSync({} as never, { id: "booking-1", currency: "ZAR" } as never, {
        paymentId: "pay-1",
        charge: { amountCents: 1000, reference: "ref-1" } as never,
      }),
    ).resolves.toBeUndefined();
  });
});
