import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminZohoInvoicePaymentLinkHelper } from "./AdminZohoInvoicePaymentLinkHelper";

describe("AdminZohoInvoicePaymentLinkHelper", () => {
  it("renders payment link helper with generate, check, copy, and open controls", () => {
    const html = renderToStaticMarkup(
      <AdminZohoInvoicePaymentLinkHelper initialInvoiceNumber="INV-001602" />,
    );

    expect(html).toContain("Payment link helper");
    expect(html).toContain("Generate payment link");
    expect(html).toContain("Check invoice");
    expect(html).toContain('value="INV-001602"');
  });
});
