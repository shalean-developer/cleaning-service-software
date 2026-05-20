import { describe, expect, it } from "vitest";
import { CUSTOMER_DASHBOARD_NAV } from "./customerNav";

describe("CUSTOMER_DASHBOARD_NAV", () => {
  it("defines a single bookings destination separate from home", () => {
    expect(CUSTOMER_DASHBOARD_NAV.map((item) => item.href)).toEqual([
      "/customer",
      "/customer/bookings",
      "/customer/book",
    ]);
    expect(CUSTOMER_DASHBOARD_NAV.find((item) => item.label === "Bookings")?.href).toBe(
      "/customer/bookings",
    );
  });
});
