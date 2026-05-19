import { describe, expect, it } from "vitest";
import { isEmailLikeCustomerSearch } from "./isEmailLikeCustomerSearch";

describe("isEmailLikeCustomerSearch", () => {
  it("returns true when query contains @", () => {
    expect(isEmailLikeCustomerSearch("user@example.com")).toBe(true);
    expect(isEmailLikeCustomerSearch("acme@")).toBe(true);
  });

  it("returns false for company/phone-only search", () => {
    expect(isEmailLikeCustomerSearch("Acme Corp")).toBe(false);
    expect(isEmailLikeCustomerSearch("0821234567")).toBe(false);
  });
});
