import { describe, expect, it } from "vitest";
import { mapZohoInvoiceToPublicStatus } from "./mapZohoInvoiceToPublicStatus";

describe("mapZohoInvoiceToPublicStatus", () => {
  it("maps operational outcomes", () => {
    expect(mapZohoInvoiceToPublicStatus({ balanceCents: 100, outcome: "not_configured" })).toBe(
      "not_configured",
    );
    expect(mapZohoInvoiceToPublicStatus({ balanceCents: 100, outcome: "not_found" })).toBe(
      "not_found",
    );
    expect(mapZohoInvoiceToPublicStatus({ balanceCents: 100, outcome: "error" })).toBe("error");
  });

  it("maps void and cancelled Zoho statuses", () => {
    expect(
      mapZohoInvoiceToPublicStatus({
        zohoStatus: "void",
        balanceCents: 500,
      }),
    ).toBe("void");
    expect(
      mapZohoInvoiceToPublicStatus({
        zohoStatus: "cancelled",
        balanceCents: 500,
      }),
    ).toBe("void");
    expect(
      mapZohoInvoiceToPublicStatus({
        zohoStatus: "canceled",
        balanceCents: 500,
      }),
    ).toBe("void");
  });

  it("maps paid when balance is zero or Zoho status is paid", () => {
    expect(
      mapZohoInvoiceToPublicStatus({
        zohoStatus: "paid",
        balanceCents: 100,
      }),
    ).toBe("paid");
    expect(
      mapZohoInvoiceToPublicStatus({
        zohoStatus: "sent",
        balanceCents: 0,
      }),
    ).toBe("paid");
  });

  it("maps payable when balance is positive and invoice is active", () => {
    expect(
      mapZohoInvoiceToPublicStatus({
        zohoStatus: "sent",
        balanceCents: 12_500,
      }),
    ).toBe("payable");
  });

  it("maps payable for active overdue invoices", () => {
    expect(
      mapZohoInvoiceToPublicStatus({
        zohoStatus: "overdue",
        balanceCents: 12_500,
      }),
    ).toBe("payable");
  });
});
