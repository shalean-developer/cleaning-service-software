import { describe, expect, it } from "vitest";
import { validateAndNormalizeInvoiceNumber } from "./invoiceNumberValidation";

describe("validateAndNormalizeInvoiceNumber", () => {
  it("accepts common Zoho invoice formats and normalizes to uppercase", () => {
    expect(validateAndNormalizeInvoiceNumber("inv-001602")).toEqual({
      ok: true,
      normalized: "INV-001602",
    });
    expect(validateAndNormalizeInvoiceNumber("INV-001602")).toEqual({
      ok: true,
      normalized: "INV-001602",
    });
    expect(validateAndNormalizeInvoiceNumber("INV001602")).toEqual({
      ok: true,
      normalized: "INV001602",
    });
  });

  it("rejects path traversal and slashes", () => {
    expect(validateAndNormalizeInvoiceNumber("../inv-001")).toMatchObject({
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
    });
    expect(validateAndNormalizeInvoiceNumber("inv/001")).toMatchObject({
      ok: false,
      code: "INVALID_INVOICE_NUMBER",
    });
  });

  it("rejects spaces and unicode", () => {
    expect(validateAndNormalizeInvoiceNumber("inv 001")).toMatchObject({
      ok: false,
    });
    expect(validateAndNormalizeInvoiceNumber("inv\u200b001")).toMatchObject({
      ok: false,
    });
  });

  it("rejects symbols outside allowed set", () => {
    expect(validateAndNormalizeInvoiceNumber("inv@001")).toMatchObject({
      ok: false,
    });
  });

  it("rejects very long strings", () => {
    expect(validateAndNormalizeInvoiceNumber("A".repeat(33))).toMatchObject({
      ok: false,
    });
  });

  it("rejects empty values", () => {
    expect(validateAndNormalizeInvoiceNumber("")).toMatchObject({ ok: false });
    expect(validateAndNormalizeInvoiceNumber("   ")).toMatchObject({ ok: false });
    expect(validateAndNormalizeInvoiceNumber(null)).toMatchObject({ ok: false });
  });
});
