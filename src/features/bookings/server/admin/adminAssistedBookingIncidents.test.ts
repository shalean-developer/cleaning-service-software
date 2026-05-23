import { describe, expect, it } from "vitest";
import { computeAdminAssistedBookingIncidents } from "./adminAssistedBookingIncidents";

describe("computeAdminAssistedBookingIncidents", () => {
  it("aggregates link regeneration loops", () => {
    const incidents = computeAdminAssistedBookingIncidents([
      {
        bookingId: "b1",
        status: "pending_payment",
        customerLabel: "Jane",
        flags: ["repeated_link_regenerate"],
        pendingAgeHours: 10,
        pilotDryRun: false,
        missingCustomerEmail: false,
        recurringCadence: null,
        recurringSelectedDays: null,
        recurringIntervalWeeks: null,
        recurringMaterializationStatus: null,
        recurringGroupId: null,
      },
    ]);

    expect(incidents.some((i) => i.category === "link_regeneration_loop")).toBe(true);
  });

  it("flags confirmed bookings as assignment escalation", () => {
    const incidents = computeAdminAssistedBookingIncidents([
      {
        bookingId: "b2",
        status: "confirmed",
        customerLabel: "Bob",
        flags: [],
        pendingAgeHours: null,
        pilotDryRun: false,
        missingCustomerEmail: false,
        recurringCadence: null,
        recurringSelectedDays: null,
        recurringIntervalWeeks: null,
        recurringMaterializationStatus: null,
        recurringGroupId: null,
      },
    ]);

    expect(incidents.some((i) => i.category === "assignment_escalation")).toBe(true);
    expect(incidents.find((i) => i.category === "assignment_escalation")?.severity).toBe("critical");
  });
});
