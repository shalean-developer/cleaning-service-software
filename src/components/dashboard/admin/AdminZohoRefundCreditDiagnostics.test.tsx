import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminZohoRefundCreditDiagnostics } from "./AdminZohoRefundCreditDiagnostics";

describe("AdminZohoRefundCreditDiagnostics", () => {
  it("renders safe diagnostic rows without metadata or secrets", () => {
    const html = renderToStaticMarkup(
      <AdminZohoRefundCreditDiagnostics
        diagnostics={{
          enabled: true,
          summary: { pending: 1, synced: 2, failed: 0 },
          rows: [
            {
              id: "sync-1",
              sourceType: "booking_refund",
              sourceId: "source-1",
              bookingId: "booking-1",
              invoiceNumber: "INV-001",
              amountCents: 5000,
              amountDisplay: "R 50.00",
              currency: "ZAR",
              reason: "Manual Paystack refund",
              syncStatus: "pending",
              syncAttempts: 1,
              lastSyncAttemptAt: null,
              nextSyncAttemptAt: "2026-07-01T12:00:00.000Z",
              safeLastError: "ZOHO_TIMEOUT",
              zohoCreditNoteId: null,
              zohoInvoiceId: "inv-1",
              paystackReference: "pay-ref",
              syncedAt: null,
              createdAt: "2026-07-01T10:00:00.000Z",
              updatedAt: "2026-07-01T10:00:00.000Z",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("booking_refund");
    expect(html).toContain("Manual Paystack refund");
    expect(html).not.toContain("metadata");
    expect(html).not.toContain("refresh_token");
    expect(html).not.toContain("authorization_code");
  });
});
