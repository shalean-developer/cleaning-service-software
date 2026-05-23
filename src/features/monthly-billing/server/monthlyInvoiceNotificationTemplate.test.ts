import { describe, expect, it } from "vitest";
import { buildMonthlyInvoiceEmailContent } from "./monthlyInvoiceNotificationTemplate";

describe("buildMonthlyInvoiceEmailContent", () => {
  it("builds invoice ready email with payment link and visit summary", () => {
    const content = buildMonthlyInvoiceEmailContent({
      customerDisplayName: "Acme Corp",
      billingMonth: "2026-05",
      invoiceNumber: "INV-100",
      totalCents: 120000,
      currency: "ZAR",
      dueDate: "2026-06-30",
      paymentUrl: "https://www.shalean.com/pay/INV-100",
      supportEmail: "support@shalean.com",
      visitSummaries: [
        { visitDate: "2026-05-10", serviceLabel: "Standard clean", amountCents: 120000 },
      ],
    });

    expect(content.subject).toBe("Your Shalean monthly cleaning invoice is ready");
    expect(content.text).toContain("Acme Corp");
    expect(content.text).toContain("INV-100");
    expect(content.text).toContain("https://www.shalean.com/pay/INV-100");
    expect(content.text).toContain("Standard clean");
  });

  it("builds reminder subject when requested", () => {
    const content = buildMonthlyInvoiceEmailContent({
      customerDisplayName: null,
      billingMonth: "2026-05",
      invoiceNumber: "INV-100",
      totalCents: 120000,
      currency: "ZAR",
      dueDate: "2026-06-30",
      paymentUrl: "https://www.shalean.com/pay/INV-100",
      supportEmail: null,
      visitSummaries: [],
      isReminder: true,
    });

    expect(content.subject).toContain("Reminder");
  });
});
