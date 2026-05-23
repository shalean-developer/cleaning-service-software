import { describe, expect, it } from "vitest";
import { buildZohoInvoicePaystackReference } from "./buildZohoInvoicePaystackReference";

describe("buildZohoInvoicePaystackReference", () => {
  it("prefixes with zi_ and includes compact invoice number and payment id suffix", () => {
    const reference = buildZohoInvoicePaystackReference(
      "INV-001602",
      "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    );
    expect(reference).toMatch(/^zi_/);
    expect(reference).toContain("INV_001602");
    expect(reference.endsWith("_aaaaaaaa")).toBe(true);
  });

  it("normalizes invoice number characters for Paystack-safe reference", () => {
    const reference = buildZohoInvoicePaystackReference(
      "inv 001/602",
      "12345678-1234-1234-1234-123456789abc",
    );
    expect(reference).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(reference.startsWith("zi_")).toBe(true);
  });

  it("keeps reference within Paystack-safe max length", () => {
    const reference = buildZohoInvoicePaystackReference(
      "A".repeat(80),
      "12345678-1234-1234-1234-123456789abc",
    );
    expect(reference.length).toBeLessThanOrEqual(100);
  });
});
