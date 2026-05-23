import { describe, expect, it } from "vitest";
import { buildZohoInvoicePaymentPageUrl } from "./buildZohoInvoicePaymentPageUrl";

describe("buildZohoInvoicePaymentPageUrl", () => {
  it("builds encoded /pay URL from canonical base URL", () => {
    expect(buildZohoInvoicePaymentPageUrl("https://www.shalean.com/", "INV-001602")).toBe(
      "https://www.shalean.com/pay/INV-001602",
    );
  });
});
