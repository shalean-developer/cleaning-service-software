import { describe, expect, it } from "vitest";
import {
  ADMIN_CUSTOMER_ASSISTED_BOOKING_DEFERRED_MESSAGE,
  ADMIN_CUSTOMER_ASSISTED_BOOKING_SUPPORTED,
} from "./adminCustomerBookingAssist";

describe("adminCustomerBookingAssist audit", () => {
  it("defers admin-assisted booking until customer-session flow exists", () => {
    expect(ADMIN_CUSTOMER_ASSISTED_BOOKING_SUPPORTED).toBe(false);
    expect(ADMIN_CUSTOMER_ASSISTED_BOOKING_DEFERRED_MESSAGE).toContain("coming soon");
  });
});
