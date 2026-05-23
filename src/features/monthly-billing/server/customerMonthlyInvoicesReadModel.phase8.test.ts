import { describe, expect, it } from "vitest";
import { buildCustomerPortalFields } from "./customerMonthlyInvoicesReadModel";

describe("customer monthly invoices portal phase 8", () => {
  it("shows overdue warning fields without internal collections data", () => {
    const fields = buildCustomerPortalFields({
      status: "overdue",
      dueDate: "2026-05-01",
      paidAt: null,
      paymentLink: "/pay/INV-100",
      invoiceNumber: "INV-100",
      financeSupportEmail: "finance@example.com",
      now: new Date("2026-05-23T12:00:00.000Z"),
    });
    expect(fields.isOverdue).toBe(true);
    expect(fields.reminderNotice).toMatch(/overdue/i);
    expect(fields).not.toHaveProperty("riskScore");
    expect(fields).not.toHaveProperty("collectionsState");
  });

  it("confirms payment received message for paid invoices", () => {
    const fields = buildCustomerPortalFields({
      status: "paid",
      dueDate: "2026-05-01",
      paidAt: "2026-05-10T12:00:00.000Z",
      paymentLink: null,
      invoiceNumber: "INV-100",
      financeSupportEmail: null,
    });
    expect(fields.paymentReceivedMessage).toMatch(/received your payment/i);
    expect(fields.isOverdue).toBe(false);
  });
});
