import { describe, expect, it } from "vitest";
import { mapZohoInvoiceFieldsToBatchPaymentStatus } from "./monthlyInvoicePaymentSyncTypes";

describe("mapZohoInvoiceFieldsToBatchPaymentStatus", () => {
  it("maps Zoho paid to paid", () => {
    expect(mapZohoInvoiceFieldsToBatchPaymentStatus({ zohoStatus: "paid", balanceCents: 0 })).toEqual({
      ok: true,
      status: "paid",
    });
  });

  it("maps zero balance to paid", () => {
    expect(mapZohoInvoiceFieldsToBatchPaymentStatus({ zohoStatus: "sent", balanceCents: 0 })).toEqual({
      ok: true,
      status: "paid",
    });
  });

  it("maps sent and open to sent", () => {
    expect(mapZohoInvoiceFieldsToBatchPaymentStatus({ zohoStatus: "sent", balanceCents: 1000 })).toEqual({
      ok: true,
      status: "sent",
    });
    expect(mapZohoInvoiceFieldsToBatchPaymentStatus({ zohoStatus: "open", balanceCents: 1000 })).toEqual({
      ok: true,
      status: "sent",
    });
  });

  it("maps overdue to overdue", () => {
    expect(mapZohoInvoiceFieldsToBatchPaymentStatus({ zohoStatus: "overdue", balanceCents: 1000 })).toEqual({
      ok: true,
      status: "overdue",
    });
  });

  it("maps void to void", () => {
    expect(mapZohoInvoiceFieldsToBatchPaymentStatus({ zohoStatus: "void", balanceCents: 1000 })).toEqual({
      ok: true,
      status: "void",
    });
  });

  it("maps draft to generated", () => {
    expect(mapZohoInvoiceFieldsToBatchPaymentStatus({ zohoStatus: "draft", balanceCents: 1000 })).toEqual({
      ok: true,
      status: "generated",
    });
  });

  it("falls back to sent for unmapped status with outstanding balance", () => {
    expect(
      mapZohoInvoiceFieldsToBatchPaymentStatus({ zohoStatus: "mystery_status", balanceCents: 1000 }),
    ).toEqual({ ok: true, status: "sent" });
  });
});
