import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminZohoInvoiceMessageTemplates } from "./AdminZohoInvoiceMessageTemplates";

describe("AdminZohoInvoiceMessageTemplates", () => {
  it("renders copyable Zoho note and customer message templates", () => {
    const html = renderToStaticMarkup(
      <AdminZohoInvoiceMessageTemplates
        paymentLink="https://www.shalean.com/pay/INV-001602"
        customerName="Jane Doe"
        invoiceNumber="INV-001602"
        amountDue="R100.00"
      />,
    );

    expect(html).toContain("Suggested Zoho invoice note");
    expect(html).toContain("Suggested email subject");
    expect(html).toContain("Suggested customer message");
    expect(html).toContain("https://www.shalean.com/pay/INV-001602");
    expect(html).toContain("Jane Doe");
    expect(html).toContain("INV-001602");
    expect(html).toContain("R100.00");
    expect(html).toContain("Invoice payment link from Shalean Cleaning Services");
  });
});
