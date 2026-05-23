import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const syncMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/features/monthly-billing/server/runPostZohoInvoicePaymentMonthlyBatchSync", () => ({
  runPostZohoInvoicePaymentMonthlyBatchSync: (...args: unknown[]) => syncMock(...args),
}));

describe("processZohoInvoiceChargeSuccess monthly batch hook", () => {
  beforeEach(() => {
    syncMock.mockClear();
  });

  it("triggers monthly batch payment sync after marking invoice paid", async () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/zoho-invoice-payments/server/processZohoInvoiceChargeSuccess.ts"),
      "utf8",
    );
    expect(source).toMatch(/triggerMonthlyBatchPaymentSyncAfterPaid/);
    expect(source).toMatch(/runPostZohoInvoicePaymentMonthlyBatchSync/);
  });

  it("does not import booking lifecycle commands", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/zoho-invoice-payments/server/processZohoInvoiceChargeSuccess.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/finalizePaidBooking/);
    expect(source).not.toMatch(/executeBookingCommand/);
  });
});
