import { describe, expect, it } from "vitest";
import { buildAdminCustomersListHref } from "./buildAdminCustomersListHref";

describe("buildAdminCustomersListHref", () => {
  it("returns base path when no filters", () => {
    expect(buildAdminCustomersListHref()).toBe("/admin/customers");
  });

  it("preserves search and filters for pagination", () => {
    expect(
      buildAdminCustomersListHref({
        page: 2,
        q: "acme",
        bookings: "has_bookings",
        health: "healthy",
        activity: "created_last_30_days",
        limit: 25,
      }),
    ).toBe(
      "/admin/customers?page=2&limit=25&q=acme&bookings=has_bookings&health=healthy&activity=created_last_30_days",
    );
  });

  it("omits default filter values", () => {
    expect(
      buildAdminCustomersListHref({
        page: 1,
        bookings: "all",
        health: "all",
        activity: "all",
      }),
    ).toBe("/admin/customers");
  });
});
