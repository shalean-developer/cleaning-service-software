import { describe, expect, it } from "vitest";
import { parseCreateCustomerBody } from "./parseCreateCustomerBody";

describe("parseCreateCustomerBody", () => {
  it("accepts phone-only create when email omitted", () => {
    const result = parseCreateCustomerBody({
      full_name: "Phone Only",
      phone: "082 123 4567",
    });
    expect(result.ok).toBe(true);
  });

  it("rejects when both email and phone missing", () => {
    const result = parseCreateCustomerBody({
      full_name: "No Contact",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid email when provided", () => {
    const result = parseCreateCustomerBody({
      full_name: "Bad Email",
      email: "not-an-email",
      phone: "082 123 4567",
    });
    expect(result.ok).toBe(false);
  });
});
