import { describe, expect, it } from "vitest";
import {
  ADMIN_BOOKING_CREATE_PATH,
  ADMIN_SIDEBAR_QUICK_ACTIONS,
  ADMIN_SIDEBAR_UTILITY_LINKS,
} from "./adminNav";

describe("ADMIN_SIDEBAR_QUICK_ACTIONS", () => {
  it("uses non-misleading labels for customer vs booking actions", () => {
    const labels = ADMIN_SIDEBAR_QUICK_ACTIONS.map((item) => item.label);
    expect(labels).toContain("Create booking");
    expect(labels).toContain("Customer booking flow");
    expect(labels).toContain("New customer");
    expect(labels).not.toContain("Booking flow");
    expect(labels).not.toContain("Quick booking");
    expect(labels).not.toContain("New booking");
  });

  it("routes admin create booking separately from customer self-serve flow", () => {
    const createBooking = ADMIN_SIDEBAR_QUICK_ACTIONS.find((item) => item.label === "Create booking");
    const customerFlow = ADMIN_SIDEBAR_QUICK_ACTIONS.find(
      (item) => item.label === "Customer booking flow",
    );

    expect(createBooking?.href).toBe(ADMIN_BOOKING_CREATE_PATH);
    expect(customerFlow?.href).toBe("/customer/book");
  });
});

describe("ADMIN_SIDEBAR_UTILITY_LINKS", () => {
  it("exposes only secondary utility links for the compact sidebar footer", () => {
    const labels = ADMIN_SIDEBAR_UTILITY_LINKS.map((item) => item.label);
    expect(labels).toEqual(["Customer booking flow"]);
    expect(labels).not.toContain("Create booking");
  });
});
