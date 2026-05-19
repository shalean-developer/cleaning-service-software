import { describe, expect, it } from "vitest";
import { parseUpdateCustomerBody } from "./parseUpdateCustomerBody";

describe("parseUpdateCustomerBody", () => {
  it("accepts partial patch with company_name only", () => {
    const result = parseUpdateCustomerBody({ company_name: "Acme" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch).toEqual({ companyName: "Acme" });
  });

  it("rejects empty company_name", () => {
    const result = parseUpdateCustomerBody({ company_name: "   " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("INVALID_PAYLOAD");
  });

  it("rejects unknown fields", () => {
    const result = parseUpdateCustomerBody({ company_name: "Acme", email: "x@y.com" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("email");
  });

  it("rejects forbidden identity fields", () => {
    const result = parseUpdateCustomerBody({ profile_id: "00000000-0000-0000-0000-000000000001" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("profile_id");
  });

  it("requires at least one field", () => {
    const result = parseUpdateCustomerBody({});
    expect(result.ok).toBe(false);
  });

  it("allows null notes to clear", () => {
    const result = parseUpdateCustomerBody({ notes: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.patch.notes).toBeNull();
  });
});
