import { describe, expect, it } from "vitest";
import {
  ADMIN_DASHBOARD_HOME,
  ADMIN_DASHBOARD_NAV,
  ADMIN_DASHBOARD_NAV_GROUPS,
} from "./adminNav";

describe("ADMIN_DASHBOARD_NAV_GROUPS", () => {
  it("includes every legacy nav route exactly once", () => {
    const groupedHrefs = [
      ADMIN_DASHBOARD_HOME.href,
      ...ADMIN_DASHBOARD_NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)),
    ];

    expect(groupedHrefs).toHaveLength(ADMIN_DASHBOARD_NAV.length);
    expect(new Set(groupedHrefs).size).toBe(ADMIN_DASHBOARD_NAV.length);

    for (const item of ADMIN_DASHBOARD_NAV) {
      expect(groupedHrefs).toContain(item.href);
    }
  });

  it("orders operational sections for the sidebar command center", () => {
    expect(ADMIN_DASHBOARD_NAV_GROUPS.map((group) => group.id)).toEqual([
      "operate",
      "insight",
    ]);
    expect(ADMIN_DASHBOARD_NAV_GROUPS[0]?.items.map((item) => item.label)).toEqual([
      "Bookings",
      "Dispatch",
      "Cleaners",
      "Customers",
    ]);
    expect(ADMIN_DASHBOARD_NAV_GROUPS[1]?.items.map((item) => item.label)).toEqual([
      "Earnings",
      "Insights",
      "Messages",
      "Assignment analytics",
    ]);
  });
});
