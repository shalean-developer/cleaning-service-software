import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminAccountingCloseDashboard } from "./AdminAccountingCloseDashboard";

describe("AdminAccountingCloseDashboard", () => {
  const baseSummary = {
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-07-31T23:59:59.999Z",
    grossSalesCents: 10000,
    refundsCreditsCents: 1000,
    netSalesCents: 9000,
    matchedAmountCents: 9000,
    pendingAmountCents: 0,
    mismatchAmountCents: 0,
    failedAmountCents: 0,
    totalTransactions: 2,
    paidTransactions: 1,
    failedTransactions: 0,
    refundCreditCount: 1,
    unresolvedCount: 0,
    readyToClose: true,
    blockingIssues: [] as string[],
  };

  const baseFilters = {
    periodType: "monthly" as const,
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-07-31T23:59:59.999Z",
    source: "all" as const,
  };

  it("renders summary cards, filters, exports, ready banner, and no mutation buttons", () => {
    const html = renderToStaticMarkup(
      <AdminAccountingCloseDashboard
        data={{
          summary: baseSummary,
          items: [
            {
              id: "booking:pay-1",
              source: "booking",
              reference: "pay-ref-1",
              invoiceNumber: "INV-001",
              bookingId: "booking-1",
              amountCents: 10000,
              currency: "ZAR",
              signedAmountCents: 10000,
              status: "matched",
              reconciliationStatus: "matched",
              issueCode: "MATCHED",
              createdAt: "2026-07-01T10:00:00.000Z",
              paidAt: "2026-07-01T10:05:00.000Z",
              syncedAt: "2026-07-01T10:05:00.000Z",
            },
          ],
        }}
        filters={baseFilters}
      />,
    );

    expect(html).toContain("Accounting close");
    expect(html).toContain("Gross sales");
    expect(html).toContain("Refunds / credits");
    expect(html).toContain("Net sales");
    expect(html).toContain("This period is ready to close.");
    expect(html).toContain("Download detail CSV");
    expect(html).toContain("Download summary CSV");
    expect(html).toContain("Apply filters");
    expect(html).not.toContain("Mark paid");
    expect(html).not.toContain("authorization_code");
  });

  it("renders warning banner when not ready to close", () => {
    const html = renderToStaticMarkup(
      <AdminAccountingCloseDashboard
        data={{
          summary: {
            ...baseSummary,
            readyToClose: false,
            blockingIssues: ["2 reconciliation mismatches"],
          },
          items: [],
        }}
        filters={baseFilters}
      />,
    );

    expect(html).toContain("This period has unresolved finance issues.");
    expect(html).toContain("2 reconciliation mismatches");
    expect(html).toContain("Open finance reconciliation");
  });
});
