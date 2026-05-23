import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminFinanceReconciliationDashboard } from "./AdminFinanceReconciliationDashboard";

describe("AdminFinanceReconciliationDashboard", () => {
  it("renders summary cards, filters, table, export, and no mutation buttons", () => {
    const html = renderToStaticMarkup(
      <AdminFinanceReconciliationDashboard
        data={{
          summary: {
            totalAmountCents: 5000,
            matchedAmountCents: 5000,
            pendingAmountCents: 0,
            mismatchAmountCents: 0,
            failedAmountCents: 0,
            matchedCount: 1,
            pendingCount: 0,
            mismatchCount: 0,
            failedCount: 0,
            bookingSalesSyncedCount: 1,
            manualInvoicePaymentsReconciledCount: 0,
            savedCardChargesReconciledCount: 0,
            refundsCreditsSyncedCount: 0,
            oldestPendingAt: null,
            latestFailedAt: null,
          },
          items: [
            {
              id: "booking:pay-1",
              source: "booking",
              reference: "pay-ref",
              bookingId: "booking-1",
              invoiceNumber: "INV-001",
              customerLabel: "Booking abc12345",
              amountCents: 5000,
              currency: "ZAR",
              shaleanStatus: "paid",
              paystackStatus: "success",
              zohoStatus: "synced",
              reconciliationStatus: "matched",
              issueCode: "MATCHED",
              issueLabel: "Matched",
              createdAt: "2026-07-01T10:00:00.000Z",
              paidAt: "2026-07-01T10:05:00.000Z",
              syncedAt: "2026-07-01T10:05:00.000Z",
              actionHint: "No action required.",
            },
          ],
          nextCursor: null,
        }}
        filters={{ source: "all", status: "all" }}
      />,
    );

    expect(html).toContain("Finance reconciliation");
    expect(html).toContain("Matched");
    expect(html).toContain("Export CSV");
    expect(html).toContain("Apply filters");
    expect(html).toContain("pay-ref");
    expect(html).not.toContain("Mark paid");
    expect(html).not.toContain("authorization_code");
    expect(html).not.toContain("refresh_token");
  });

  it("renders empty state", () => {
    const html = renderToStaticMarkup(
      <AdminFinanceReconciliationDashboard
        data={{
          summary: {
            totalAmountCents: 0,
            matchedAmountCents: 0,
            pendingAmountCents: 0,
            mismatchAmountCents: 0,
            failedAmountCents: 0,
            matchedCount: 0,
            pendingCount: 0,
            mismatchCount: 0,
            failedCount: 0,
            bookingSalesSyncedCount: 0,
            manualInvoicePaymentsReconciledCount: 0,
            savedCardChargesReconciledCount: 0,
            refundsCreditsSyncedCount: 0,
            oldestPendingAt: null,
            latestFailedAt: null,
          },
          items: [],
          nextCursor: null,
        }}
        filters={{ source: "all", status: "all" }}
      />,
    );

    expect(html).toContain("No reconciliation items match the current filters");
  });
});
