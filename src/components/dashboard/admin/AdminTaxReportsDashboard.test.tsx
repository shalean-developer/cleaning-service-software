import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminTaxReportsDashboard } from "./AdminTaxReportsDashboard";

describe("AdminTaxReportsDashboard", () => {
  const baseFilters = {
    periodType: "monthly" as const,
    from: "2026-07-01T00:00:00.000Z",
    to: "2026-07-31T23:59:59.999Z",
    source: "all" as const,
    includeUnresolved: false,
  };

  const baseSummary = {
    periodStart: "2026-07-01T00:00:00.000Z",
    periodEnd: "2026-07-31T23:59:59.999Z",
    vatRegistered: false,
    vatRate: 15,
    grossSalesCents: 11500,
    refundsCreditsCents: 0,
    netSalesAfterCreditsCents: 11500,
    estimatedOutputVatCents: 0,
    netExcludingVatCents: 11500,
    transactionCount: 1,
    refundCreditCount: 0,
  };

  it("renders VAT disabled banner, summary cards, exports, disclaimer, and no mutation buttons", () => {
    const html = renderToStaticMarkup(
      <AdminTaxReportsDashboard
        data={{
          summary: baseSummary,
          items: [
            {
              id: "booking:pay-1",
              source: "booking",
              reference: "pay-ref-1",
              invoiceNumber: "INV-001",
              bookingId: "booking-1",
              grossAmountCents: 11500,
              signedAmountCents: 11500,
              estimatedVatCents: 0,
              netExcludingVatCents: 11500,
              currency: "ZAR",
              paidAt: "2026-07-01T10:05:00.000Z",
              createdAt: "2026-07-01T10:00:00.000Z",
              reconciliationStatus: "matched",
              unresolved: false,
            },
          ],
          sourceBreakdown: [
            {
              source: "booking",
              grossSalesCents: 11500,
              refundsCreditsCents: 0,
              netSalesCents: 11500,
              estimatedVatCents: 0,
              count: 1,
            },
          ],
          includesUnresolved: false,
          hasUnresolvedWarning: false,
        }}
        filters={baseFilters}
      />,
    );

    expect(html).toContain("VAT not enabled");
    expect(html).toContain("Gross sales");
    expect(html).toContain("Download tax detail CSV");
    expect(html).toContain("reviewed by your accountant");
    expect(html).not.toContain("Mark paid");
    expect(html).not.toContain("authorization_code");
  });

  it("renders VAT enabled banner when registered", () => {
    const html = renderToStaticMarkup(
      <AdminTaxReportsDashboard
        data={{
          summary: { ...baseSummary, vatRegistered: true, estimatedOutputVatCents: 1500 },
          items: [],
          sourceBreakdown: [],
          includesUnresolved: false,
          hasUnresolvedWarning: false,
        }}
        filters={baseFilters}
      />,
    );

    expect(html).toContain("VAT reporting is enabled at 15%.");
  });

  it("renders unresolved warning when includeUnresolved includes pending items", () => {
    const html = renderToStaticMarkup(
      <AdminTaxReportsDashboard
        data={{
          summary: baseSummary,
          items: [],
          sourceBreakdown: [],
          includesUnresolved: true,
          hasUnresolvedWarning: true,
        }}
        filters={{ ...baseFilters, includeUnresolved: true }}
      />,
    );

    expect(html).toContain("Unresolved items included");
  });
});
