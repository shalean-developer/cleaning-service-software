import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ZohoInvoicePayButton } from "./ZohoInvoicePayButton";

describe("ZohoInvoicePayButton", () => {
  it("renders unchecked consent checkbox by default", () => {
    const html = renderToStaticMarkup(<ZohoInvoicePayButton invoiceNumber="INV-001602" />);

    expect(html).toContain("authorise Shalean Cleaning Services");
    expect(html).toContain('type="checkbox"');
    expect(html).not.toContain("checked");
  });
});
