import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminZohoPaymentsWorkflow } from "./AdminZohoPaymentsWorkflow";

describe("AdminZohoPaymentsWorkflow", () => {
  it("renders link helper, templates, and future automation guidance", () => {
    const html = renderToStaticMarkup(
      <AdminZohoPaymentsWorkflow initialInvoiceNumber="INV-001602" />,
    );

    expect(html).toContain("Payment link helper");
    expect(html).toContain("Zoho note and customer message templates");
    expect(html).toContain("Future phase: Zoho invoice note automation");
  });
});
