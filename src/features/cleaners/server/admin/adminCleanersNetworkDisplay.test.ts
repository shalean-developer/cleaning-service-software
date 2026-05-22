import { describe, expect, it } from "vitest";
import type { AdminCleanerListItem } from "./types";
import {
  buildAdminCleanerNetworkCardModel,
  computeAdminCleanerNetworkStats,
  filterAdminCleanersForNetworkView,
  resolveCleanerNetworkStatus,
} from "./adminCleanersNetworkDisplay";

function sampleItem(overrides: Partial<AdminCleanerListItem> = {}): AdminCleanerListItem {
  return {
    id: "cleaner-1",
    name: "Sarah Khoza",
    email: "sarah@example.com",
    phone: "+27 82 000 0000",
    operationalState: "active",
    active: true,
    isSuspended: false,
    averageRating: 4.9,
    primaryAreaLabel: "Atlantic Seaboard",
    openOffersCount: 0,
    activeBookingsCount: 0,
    pendingEarningsCount: 0,
    lastLifecycleAction: null,
    ...overrides,
  };
}

describe("adminCleanersNetworkDisplay", () => {
  it("maps active cleaners without visits to available", () => {
    expect(resolveCleanerNetworkStatus(sampleItem())).toBe("available");
  });

  it("maps active bookings to on visit", () => {
    expect(resolveCleanerNetworkStatus(sampleItem({ activeBookingsCount: 2 }))).toBe("on_visit");
  });

  it("maps suspended cleaners to paused", () => {
    expect(
      resolveCleanerNetworkStatus(
        sampleItem({ operationalState: "suspended", isSuspended: true }),
      ),
    ).toBe("paused");
  });

  it("computes network stats across the roster", () => {
    const stats = computeAdminCleanerNetworkStats([
      sampleItem(),
      sampleItem({ id: "c2", activeBookingsCount: 1 }),
      sampleItem({ id: "c3", operationalState: "suspended", isSuspended: true }),
      sampleItem({ id: "c4", operationalState: "archived", active: false }),
    ]);
    expect(stats.available).toBe(1);
    expect(stats.on_visit).toBe(1);
    expect(stats.paused).toBe(1);
    expect(stats.offline).toBe(1);
  });

  it("filters top performers by rating", () => {
    const items = [
      sampleItem({ id: "a", averageRating: 4.9 }),
      sampleItem({ id: "b", averageRating: 4.2 }),
    ];
    const filtered = filterAdminCleanersForNetworkView({
      items,
      view: "top_performers",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("a");
  });

  it("builds card model with initials and badges", () => {
    const model = buildAdminCleanerNetworkCardModel(sampleItem());
    expect(model.initials).toBe("SK");
    expect(model.areaLabel).toBe("Atlantic Seaboard");
    expect(model.badgeLabels).toContain("Top performer");
  });
});
