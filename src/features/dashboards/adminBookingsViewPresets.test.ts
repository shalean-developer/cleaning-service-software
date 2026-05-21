import { describe, expect, it } from "vitest";
import {
  buildAdminBookingsViewChipHref,
  filterAdminBookingsForView,
  resolveAdminBookingsViewChip,
} from "./adminBookingsViewPresets";
import type { AdminBookingListItem } from "./server/types";

function sampleBooking(
  overrides: Partial<AdminBookingListItem> = {},
): AdminBookingListItem {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    status: "confirmed",
    paymentStatus: "paid",
    paymentFailureReason: null,
    customerLabel: "Test Customer",
    cleanerLabel: null,
    serviceLabel: "Regular Cleaning",
    scheduleLabel: "Today",
    priceLabel: "R 720,00",
    priceCents: 72000,
    observation: {
      isTwoCleanerRequest: false,
      operationalLoad: { score: 0, signals: [] },
      teamRequestFulfillment: null,
      teamRequestFulfillmentLabel: null,
      teamSupportOps: { coordinationStatus: null },
      supportingCleanerLabel: null,
      coordinationStatusLabel: null,
      hasTeamSupportNotes: false,
    },
    assignmentAttention: null,
    updatedAt: new Date().toISOString(),
    isRecurring: false,
    ...overrides,
  };
}

describe("adminBookingsViewPresets", () => {
  it("resolves attention from assignment_attention filter", () => {
    expect(
      resolveAdminBookingsViewChip({ filter: "assignment_attention" }),
    ).toBe("attention");
  });

  it("filters recurring and completed views in memory", () => {
    const bookings = [
      sampleBooking({ id: "a", isRecurring: true, status: "confirmed" }),
      sampleBooking({ id: "b", isRecurring: false, status: "completed" }),
      sampleBooking({ id: "c", isRecurring: false, status: "confirmed" }),
    ];
    expect(filterAdminBookingsForView(bookings, "recurring")).toHaveLength(1);
    expect(filterAdminBookingsForView(bookings, "completed")).toHaveLength(1);
    expect(filterAdminBookingsForView(bookings, "all")).toHaveLength(3);
  });

  it("builds chip hrefs without breaking all bookings path", () => {
    expect(buildAdminBookingsViewChipHref({}, "all")).toBe("/admin/bookings");
    const recurringHref = buildAdminBookingsViewChipHref({ q: "acme" }, "recurring");
    expect(recurringHref).toContain("view=recurring");
    expect(recurringHref).toContain("q=acme");
  });
});
