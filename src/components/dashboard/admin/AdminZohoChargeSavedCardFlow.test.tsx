import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminZohoChargeSavedCardFlow } from "./AdminZohoChargeSavedCardFlow";

describe("AdminZohoChargeSavedCardFlow", () => {
  it("does not render when invoice is not payable", () => {
    const html = renderToStaticMarkup(
      <AdminZohoChargeSavedCardFlow
        adminCardChargesEnabled
        invoiceContext={{
          invoiceNumber: "INV-001602",
          customerName: "Jane",
          amountDueDisplay: "R 100.00",
          canPayNow: false,
        }}
      />,
    );
    expect(html).toBe("");
  });

  it("shows disabled message when admin card charges flag is off", () => {
    const html = renderToStaticMarkup(
      <AdminZohoChargeSavedCardFlow
        adminCardChargesEnabled={false}
        invoiceContext={{
          invoiceNumber: "INV-001602",
          customerName: "Jane",
          amountDueDisplay: "R 100.00",
          canPayNow: true,
        }}
      />,
    );
    expect(html).toContain("disabled globally");
    expect(html).not.toContain("Review charge");
  });

  it("shows consent warning and no custom amount input when payable", () => {
    const html = renderToStaticMarkup(
      <AdminZohoChargeSavedCardFlow
        adminCardChargesEnabled
        invoiceContext={{
          invoiceNumber: "INV-001602",
          customerName: "Jane",
          amountDueDisplay: "R 100.00",
          canPayNow: true,
        }}
      />,
    );
    expect(html).toContain("Charge saved card");
    expect(html).toContain("Consent required");
    expect(html).toContain("Do not use this for automatic recurring billing yet.");
    expect(html).not.toContain('type="number"');
    expect(html).not.toContain("authorization_code");
  });
});
