import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminZohoDailyPaymentChecks } from "./AdminZohoDailyPaymentChecks";

describe("AdminZohoDailyPaymentChecks", () => {
  it("renders empty state when all counts are zero", () => {
    const html = renderToStaticMarkup(
      <AdminZohoDailyPaymentChecks
        metrics={{
          reconcileFailedCount: 0,
          reconcilePendingCount: 0,
          failedAdminCardCharges: 0,
          failedInvoicePayments: 0,
          revokedMethodAuditCount: 0,
          lastCronRun: null,
          featureState: {
            invoicePaymentsEnabled: true,
            savedMethodsEnabled: true,
            adminCardChargesEnabled: false,
            zohoConfigured: true,
            paystackEnabled: true,
            paystackMode: "test",
            cronSecretConfigured: true,
            paystackWebhookConfigured: true,
          },
        }}
      />,
    );

    expect(html).toContain("Daily payment checks");
    expect(html).toContain("No payment issues recorded yet");
  });

  it("renders metric counts when data exists", () => {
    const html = renderToStaticMarkup(
      <AdminZohoDailyPaymentChecks
        metrics={{
          reconcileFailedCount: 2,
          reconcilePendingCount: 1,
          failedAdminCardCharges: 3,
          failedInvoicePayments: 0,
          revokedMethodAuditCount: 0,
          lastCronRun: null,
          featureState: {
            invoicePaymentsEnabled: true,
            savedMethodsEnabled: true,
            adminCardChargesEnabled: false,
            zohoConfigured: true,
            paystackEnabled: true,
            paystackMode: "test",
            cronSecretConfigured: true,
            paystackWebhookConfigured: true,
          },
        }}
      />,
    );

    expect(html).toContain("Reconciliation failed");
    expect(html).toContain(">2<");
    expect(html).toContain("Failed admin card charges");
  });
});
