import { describe, expect, it } from "vitest";
import { computeAdminAssistedBookingFriction } from "./adminAssistedBookingFriction";

describe("computeAdminAssistedBookingFriction", () => {
  it("flags repeated regenerate and missing email bookings", () => {
    const { metrics, flaggedBookings } = computeAdminAssistedBookingFriction(
      [
        {
          id: "b1",
          status: "pending_payment",
          metadata: { adminAssist: { source: "admin_wizard", pilotDryRun: true } },
          updated_at: new Date(Date.now() - 80 * 3_600_000).toISOString(),
          created_at: new Date(Date.now() - 80 * 3_600_000).toISOString(),
          customer_name: "Jane",
          customer_email: null,
        },
      ],
      [
        {
          bookingId: "b1",
          action: "admin_booking_payment_link_regenerated",
          createdAt: new Date().toISOString(),
          payload: {},
        },
        {
          bookingId: "b1",
          action: "admin_booking_payment_link_regenerated",
          createdAt: new Date().toISOString(),
          payload: {},
        },
      ],
      {
        stalePendingHours: 72,
        failedNotificationBookingIds: new Set(["b1"]),
      },
    );

    expect(metrics.pilotDryRunBookings).toBe(1);
    expect(metrics.missingCustomerEmailBookings).toBe(1);
    expect(metrics.bookingsWithRepeatedRegenerate).toBe(1);
    expect(flaggedBookings[0]?.flags).toContain("repeated_link_regenerate");
    expect(flaggedBookings[0]?.flags).toContain("missing_customer_email");
  });
});
