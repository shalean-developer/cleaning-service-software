import { describe, expect, it } from "vitest";
import {
  applyAdminCustomersListFilters,
  computeLastActivityAt,
  matchesActivityFilter,
  matchesBookingsFilter,
  matchesHealthFilter,
  requiresInMemoryListPipeline,
} from "./adminCustomersListFilters";
import type { AdminCustomerListItem } from "./types";
import type { ParsedAdminCustomersQuery } from "./parseAdminCustomersQuery";

const NOW = new Date("2026-05-19T12:00:00.000Z").getTime();

function baseItem(overrides: Partial<AdminCustomerListItem> = {}): AdminCustomerListItem {
  return {
    customerId: "cust-1",
    profileId: "prof-1",
    companyName: "Acme",
    authEmail: "a@acme.test",
    phone: null,
    notes: null,
    profileRole: "customer",
    bookingCount: 1,
    recurringCount: 0,
    latestBooking: {
      id: "b1",
      status: "confirmed",
      scheduledStart: "2026-05-10T10:00:00.000Z",
      createdAt: "2026-05-01T10:00:00.000Z",
      serviceLabel: "Standard clean",
    },
    lastActivityAt: "2026-05-10T10:00:00.000Z",
    areaLabel: null,
    lifetimeValueCents: 0,
    lastVisitAt: null,
    preferredCleanerId: null,
    preferredCleanerLabel: null,
    domainHealth: {
      code: "HEALTHY",
      label: "Healthy",
      tone: "success",
      detail: "ok",
    },
    provisioningHealthy: true,
    createdAt: "2026-04-01T10:00:00.000Z",
    updatedAt: "2026-05-10T10:00:00.000Z",
    ...overrides,
  };
}

const defaultQuery: ParsedAdminCustomersQuery = {
  page: 1,
  limit: 50,
  bookings: "all",
  health: "all",
  activity: "all",
};

describe("adminCustomersListFilters", () => {
  it("requires in-memory pipeline for search and non-default filters", () => {
    expect(requiresInMemoryListPipeline(defaultQuery)).toBe(false);
    expect(requiresInMemoryListPipeline({ ...defaultQuery, q: "acme" })).toBe(true);
    expect(requiresInMemoryListPipeline({ ...defaultQuery, bookings: "no_bookings" })).toBe(
      true,
    );
    expect(requiresInMemoryListPipeline({ ...defaultQuery, health: "healthy" })).toBe(true);
    expect(
      requiresInMemoryListPipeline({ ...defaultQuery, activity: "active_last_30_days" }),
    ).toBe(true);
    expect(
      requiresInMemoryListPipeline({ ...defaultQuery, activity: "created_last_7_days" }),
    ).toBe(false);
  });

  it("filters has_bookings and no_bookings", () => {
    const withBooking = baseItem({ bookingCount: 2 });
    const without = baseItem({ bookingCount: 0, latestBooking: null });

    expect(matchesBookingsFilter(withBooking, "has_bookings")).toBe(true);
    expect(matchesBookingsFilter(without, "has_bookings")).toBe(false);
    expect(matchesBookingsFilter(without, "no_bookings")).toBe(true);
    expect(matchesBookingsFilter(withBooking, "no_bookings")).toBe(false);
  });

  it("filters health healthy vs needs_attention", () => {
    const healthy = baseItem();
    const unhealthy = baseItem({
      provisioningHealthy: false,
      domainHealth: {
        code: "DUAL_DOMAIN",
        label: "Dual domain",
        tone: "danger",
        detail: "dual",
      },
    });

    expect(matchesHealthFilter(healthy, "healthy")).toBe(true);
    expect(matchesHealthFilter(unhealthy, "healthy")).toBe(false);
    expect(matchesHealthFilter(unhealthy, "needs_attention")).toBe(true);
    expect(matchesHealthFilter(healthy, "needs_attention")).toBe(false);
  });

  it("filters recent activity windows", () => {
    const recent = baseItem({
      createdAt: "2026-05-15T10:00:00.000Z",
      updatedAt: "2026-05-18T10:00:00.000Z",
      lastActivityAt: "2026-05-18T10:00:00.000Z",
    });
    const stale = baseItem({
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-15T10:00:00.000Z",
      lastActivityAt: "2026-01-15T10:00:00.000Z",
      latestBooking: null,
    });

    expect(matchesActivityFilter(recent, "created_last_7_days", NOW)).toBe(true);
    expect(matchesActivityFilter(stale, "created_last_7_days", NOW)).toBe(false);
    expect(matchesActivityFilter(recent, "active_last_30_days", NOW)).toBe(true);
    expect(matchesActivityFilter(stale, "active_last_30_days", NOW)).toBe(false);
  });

  it("computeLastActivityAt uses latest booking or profile update", () => {
    const item = baseItem({
      updatedAt: "2026-05-01T10:00:00.000Z",
      latestBooking: {
        id: "b1",
        status: "confirmed",
        scheduledStart: "2026-05-10T10:00:00.000Z",
        createdAt: "2026-05-12T10:00:00.000Z",
        serviceLabel: null,
      },
    });
    expect(computeLastActivityAt(item)).toBe("2026-05-12T10:00:00.000Z");
  });

  it("applyAdminCustomersListFilters composes all filters", () => {
    const items = [
      baseItem({ customerId: "a", bookingCount: 0, latestBooking: null, provisioningHealthy: true }),
      baseItem({
        customerId: "b",
        bookingCount: 3,
        provisioningHealthy: false,
        domainHealth: {
          code: "ROLE_MISMATCH",
          label: "Mismatch",
          tone: "warning",
          detail: "x",
        },
      }),
    ];

    const filtered = applyAdminCustomersListFilters(items, {
      ...defaultQuery,
      bookings: "has_bookings",
      health: "needs_attention",
    });

    expect(filtered.map((i) => i.customerId)).toEqual(["b"]);
  });
});
