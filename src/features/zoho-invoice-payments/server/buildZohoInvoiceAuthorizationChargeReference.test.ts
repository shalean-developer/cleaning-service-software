import { describe, expect, it } from "vitest";
import { buildZohoInvoiceAuthorizationChargeReference } from "./buildZohoInvoiceAuthorizationChargeReference";

describe("buildZohoInvoiceAuthorizationChargeReference", () => {
  it("builds zia_ references with compact invoice number", () => {
    const reference = buildZohoInvoiceAuthorizationChargeReference(
      "INV-001602",
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );
    expect(reference).toMatch(/^zia_INV_001602_/);
    expect(reference.length).toBeLessThanOrEqual(100);
  });
});
