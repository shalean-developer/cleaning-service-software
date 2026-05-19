import { describe, expect, it } from "vitest";
import { normalizeCustomerEmail, parseCreateCustomerBody } from "./parseCreateCustomerBody";

describe("parseCreateCustomerBody", () => {
  it("accepts valid payload", () => {
    const result = parseCreateCustomerBody({
      email: " Ada@Example.COM ",
      full_name: "Ada Customer",
      company_name: "Ada Co",
      phone: "0821234567",
      notes: "VIP",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.values.email).toBe("Ada@Example.COM");
    expect(result.values.full_name).toBe("Ada Customer");
  });

  it("rejects missing full name", () => {
    const result = parseCreateCustomerBody({ email: "a@b.com" });
    expect(result.ok).toBe(false);
  });
});

describe("normalizeCustomerEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeCustomerEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});
