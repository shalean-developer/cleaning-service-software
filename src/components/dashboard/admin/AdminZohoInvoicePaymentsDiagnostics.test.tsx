import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminZohoInvoicePaymentsDiagnostics } from "./AdminZohoInvoicePaymentsDiagnostics";

const basePayment = {
  invoiceNumber: "INV-001602",
  amountCents: 10_000,
  amountDisplay: "R100.00",
  currency: "ZAR",
  reconcileAttempts: 1,
  lastReconcileAttemptAt: "2026-01-01T00:00:00.000Z",
  nextReconcileAttemptAt: "2026-01-01T00:05:00.000Z",
  safeLastError: "ZOHO_HTTP_ERROR",
  maskedCustomerEmail: "j***@example.com",
  paymentPageUrl: "https://www.shalean.com/pay/INV-001602",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  paidAt: null,
};

describe("AdminZohoInvoicePaymentsDiagnostics", () => {
  it("renders summary cards, status helper text, and link actions without mutation controls", () => {
    const html = renderToStaticMarkup(
      <AdminZohoInvoicePaymentsDiagnostics
        diagnostics={{
          summary: {
            pending_paystack: 1,
            paid: 3,
            failed: 0,
            zoho_reconcile_pending: 2,
            zoho_reconcile_failed: 1,
          },
          payments: [
            {
              ...basePayment,
              status: "zoho_reconcile_pending",
            },
            {
              ...basePayment,
              status: "paid",
              safeLastError: null,
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Paid");
    expect(html).toContain("Reconciliation pending");
    expect(html).toContain("INV-001602");
    expect(html).toContain("Paystack payment succeeded; Zoho reconciliation is retrying.");
    expect(html).toContain("Payment confirmed and Zoho reconciliation completed.");
    expect(html).toContain("Copy payment link");
    expect(html).toContain("Open customer page");
    expect(html).toContain("https://www.shalean.com/pay/INV-001602");
    expect(html).not.toContain("Retry reconciliation");
    expect(html).not.toContain("Mark paid");
    expect(html).not.toContain("Force paid");
  });

  it("shows empty state when no problematic payments", () => {
    const html = renderToStaticMarkup(
      <AdminZohoInvoicePaymentsDiagnostics
        diagnostics={{
          summary: {
            pending_paystack: 0,
            paid: 0,
            failed: 0,
            zoho_reconcile_pending: 0,
            zoho_reconcile_failed: 0,
          },
          payments: [],
        }}
      />,
    );

    expect(html).toContain("No Zoho invoice payment issues found.");
  });
});
