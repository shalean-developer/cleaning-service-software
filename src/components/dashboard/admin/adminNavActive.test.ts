import { describe, expect, it } from "vitest";
import { isAdminNavItemActive } from "./adminNavActive";

describe("isAdminNavItemActive", () => {
  it("returns false when pathname is unavailable", () => {
    expect(isAdminNavItemActive(null, "/admin")).toBe(false);
  });

  it("matches home only on exact /admin", () => {
    expect(isAdminNavItemActive("/admin", "/admin")).toBe(true);
    expect(isAdminNavItemActive("/admin/cleaners", "/admin")).toBe(false);
  });

  it("matches nested routes for section hrefs", () => {
    expect(isAdminNavItemActive("/admin/cleaners/abc", "/admin/cleaners")).toBe(true);
    expect(isAdminNavItemActive("/admin/bookings", "/admin/bookings")).toBe(true);
    expect(isAdminNavItemActive("/admin/bookings/abc", "/admin/bookings")).toBe(true);
  });

  it("does not cross-match sibling analytics routes", () => {
    expect(isAdminNavItemActive("/admin/analytics/team-support", "/admin/analytics/assignments")).toBe(
      false,
    );
    expect(isAdminNavItemActive("/admin/analytics/assignments", "/admin/analytics/assignments")).toBe(
      true,
    );
  });
});
