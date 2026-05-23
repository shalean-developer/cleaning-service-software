import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_CUSTOMER_ASSISTED_BOOKING_DEFERRED_MESSAGE,
  buildAdminBookingCreateHref,
  isAdminAssistedBookingDraftEnabled,
} from "./adminCustomerBookingAssist";

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: () => true,
}));

describe("adminCustomerBookingAssist", () => {
  it("builds create href with customerId query", () => {
    expect(buildAdminBookingCreateHref("abc-123")).toBe(
      "/admin/bookings/create?customerId=abc-123",
    );
    expect(buildAdminBookingCreateHref()).toBe("/admin/bookings/create");
  });

  it("reflects feature flag for draft booking", () => {
    expect(isAdminAssistedBookingDraftEnabled()).toBe(true);
  });

  it("documents deferred message when flag off", () => {
    expect(ADMIN_CUSTOMER_ASSISTED_BOOKING_DEFERRED_MESSAGE).toContain(
      "ADMIN_ASSISTED_BOOKING_ENABLED",
    );
  });
});
