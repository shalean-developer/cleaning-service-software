import { describe, expect, it } from "vitest";
import {
  mapRefundCreditToStatement,
  mapSavedCardChargeToStatement,
  mapZohoInvoicePaymentToStatement,
} from "./corporateStatementStatus";

describe("corporateStatementStatus", () => {
  it("maps paid invoice payment as credit payment", () => {
    const mapped = mapZohoInvoicePaymentToStatement({
      invoiceNumber: "INV-001",
      amountCents: 10000,
      status: "paid",
      customerName: "Acme Corp",
    });
    expect(mapped.type).toBe("payment");
    expect(mapped.status).toBe("paid");
    expect(mapped.debitCents).toBe(0);
    expect(mapped.creditCents).toBe(10000);
  });

  it("maps pending checkout as outstanding invoice debit", () => {
    const mapped = mapZohoInvoicePaymentToStatement({
      invoiceNumber: "INV-002",
      amountCents: 5000,
      status: "pending_paystack",
      customerName: null,
    });
    expect(mapped.type).toBe("invoice");
    expect(mapped.status).toBe("outstanding");
    expect(mapped.debitCents).toBe(5000);
    expect(mapped.creditCents).toBe(0);
  });

  it("maps paid saved-card charge as credit", () => {
    const mapped = mapSavedCardChargeToStatement({
      invoiceNumber: "INV-003",
      amountCents: 7500,
      status: "paid",
    });
    expect(mapped.type).toBe("saved_card_payment");
    expect(mapped.creditCents).toBe(7500);
  });

  it("maps synced refund credit as credited", () => {
    const mapped = mapRefundCreditToStatement({
      invoiceNumber: "INV-001",
      bookingId: null,
      amountCents: 2000,
      syncStatus: "synced",
    });
    expect(mapped.type).toBe("refund_credit");
    expect(mapped.status).toBe("credited");
    expect(mapped.creditCents).toBe(2000);
  });
});
