import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminZohoSalesSyncDiagnostics } from "./AdminZohoSalesSyncDiagnostics";

describe("AdminZohoSalesSyncDiagnostics", () => {
  it("renders safe summary without secrets", () => {
    const html = renderToStaticMarkup(
      <AdminZohoSalesSyncDiagnostics
        diagnostics={{
          enabled: true,
          summary: { pending: 1, synced: 2, failed: 0 },
          rows: [
            {
              id: "sync-1",
              sourceType: "booking",
              sourceId: "booking-1",
              bookingId: "booking-1",
              bookingReference: "booking-1",
              invoiceNumber: "INV-001",
              amountCents: 5000,
              amountDisplay: "R 50.00",
              currency: "ZAR",
              syncStatus: "pending",
              syncAttempts: 1,
              lastSyncAttemptAt: null,
              nextSyncAttemptAt: null,
              safeLastError: "ZOHO_API_ERROR",
              zohoInvoiceId: null,
              syncedAt: null,
              createdAt: "2026-05-01T00:00:00.000Z",
              updatedAt: "2026-05-01T00:00:00.000Z",
            },
          ],
        }}
      />,
    );

    expect(html).toContain("Pending");
    expect(html).toContain("booking");
    expect(html).not.toContain("authorization_code");
    expect(html).not.toContain("refresh_token");
  });
});
