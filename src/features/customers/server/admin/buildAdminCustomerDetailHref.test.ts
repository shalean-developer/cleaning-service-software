import { describe, expect, it } from "vitest";
import { buildAdminCustomerDetailHref } from "./buildAdminCustomerDetailHref";

describe("buildAdminCustomerDetailHref", () => {
  const customerId = "550e8400-e29b-41d4-a716-446655440000";

  it("omits query when filter is all", () => {
    expect(buildAdminCustomerDetailHref(customerId)).toBe(
      `/admin/customers/${customerId}`,
    );
  });

  it("preserves booking filter in query string", () => {
    expect(
      buildAdminCustomerDetailHref(customerId, { bookingFilter: "pending_payment" }),
    ).toBe(`/admin/customers/${customerId}?bookingFilter=pending_payment`);
  });
});
