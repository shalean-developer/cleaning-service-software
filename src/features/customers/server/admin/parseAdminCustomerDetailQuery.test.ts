import { describe, expect, it } from "vitest";
import { parseAdminCustomerDetailQueryParams } from "./parseAdminCustomerDetailQuery";

describe("parseAdminCustomerDetailQueryParams", () => {
  it("defaults bookingFilter to all", () => {
    const parsed = parseAdminCustomerDetailQueryParams(new URLSearchParams());
    expect(parsed.bookingFilter).toBe("all");
  });

  it("parses valid booking filters", () => {
    const parsed = parseAdminCustomerDetailQueryParams(
      new URLSearchParams({ bookingFilter: "pending_payment" }),
    );
    expect(parsed.bookingFilter).toBe("pending_payment");
  });

  it("rejects invalid booking filter", () => {
    expect(() =>
      parseAdminCustomerDetailQueryParams(
        new URLSearchParams({ bookingFilter: "invalid" }),
      ),
    ).toThrow();
  });
});
