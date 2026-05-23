import { describe, expect, it } from "vitest";
import { ADMIN_SIDEBAR_QUICK_ACTIONS } from "./adminNav";

describe("ADMIN_SIDEBAR_QUICK_ACTIONS", () => {
  it("uses non-misleading labels for customer vs booking actions", () => {
    const labels = ADMIN_SIDEBAR_QUICK_ACTIONS.map((item) => item.label);
    expect(labels).toContain("Customer booking flow");
    expect(labels).toContain("New customer");
    expect(labels).not.toContain("Booking flow");
    expect(labels).not.toContain("Quick booking");
    expect(labels).not.toContain("New booking");
  });
});
