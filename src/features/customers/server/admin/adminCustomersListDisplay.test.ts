import { describe, expect, it } from "vitest";
import {
  adminCustomersEmptyState,
  formatAdminCustomerLatestBooking,
} from "./adminCustomersListDisplay";

describe("adminCustomersListDisplay", () => {
  it("formats latest booking with service or no-bookings copy", () => {
    expect(formatAdminCustomerLatestBooking(null)).toBe("No bookings yet");
    expect(
      formatAdminCustomerLatestBooking({
        id: "b1",
        status: "confirmed",
        scheduledStart: "2026-05-10T10:00:00.000Z",
        createdAt: "2026-05-01T10:00:00.000Z",
        serviceLabel: "Deep clean",
      }),
    ).toContain("Deep clean");
    expect(
      formatAdminCustomerLatestBooking({
        id: "b1",
        status: "draft",
        scheduledStart: "2026-05-10T10:00:00.000Z",
        createdAt: "2026-05-01T10:00:00.000Z",
        serviceLabel: null,
      }),
    ).toContain("draft");
  });

  it("returns filter-aware empty state copy", () => {
    const empty = adminCustomersEmptyState({
      page: 1,
      limit: 50,
      q: "zzz",
      bookings: "no_bookings",
      health: "all",
      activity: "all",
    });
    expect(empty.title).toContain("match");
    expect(empty.description).toContain("without bookings");
  });
});
