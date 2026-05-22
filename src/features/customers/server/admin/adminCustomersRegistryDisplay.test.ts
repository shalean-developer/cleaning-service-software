import { describe, expect, it } from "vitest";
import type { AdminCustomerListItem } from "./types";
import {
  buildAdminCustomerRegistryCardModel,
  computeAdminCustomerRegistryStats,
  filterAdminCustomersForRegistryView,
  formatRegistryZar,
  formatRelativeLastVisit,
  isVipCustomer,
  resolveCustomerCareFlags,
} from "./adminCustomersRegistryDisplay";

function baseItem(overrides: Partial<AdminCustomerListItem> = {}): AdminCustomerListItem {
  return {
    customerId: "cust-1",
    profileId: "prof-1",
    companyName: "Naledi Khumalo",
    authEmail: "naledi@example.com",
    phone: null,
    notes: null,
    profileRole: "customer",
    bookingCount: 5,
    recurringCount: 1,
    latestBooking: null,
    lastActivityAt: new Date().toISOString(),
    areaLabel: "Sea Point",
    lifetimeValueCents: 1_824_000,
    lastVisitAt: new Date().toISOString(),
    preferredCleanerId: null,
    preferredCleanerLabel: "Sarah Khoza",
    domainHealth: {
      code: "HEALTHY",
      label: "Provisioning healthy",
      tone: "success",
      detail: "ok",
    },
    provisioningHealthy: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("adminCustomersRegistryDisplay", () => {
  it("formats ZAR without decimals for registry stats", () => {
    expect(formatRegistryZar(45_660_00)).toContain("45");
    expect(formatRegistryZar(45_660_00)).toMatch(/R/);
  });

  it("formats relative last visit labels", () => {
    const today = new Date();
    expect(formatRelativeLastVisit(today.toISOString())).toBe("Today");
    expect(formatRelativeLastVisit(null)).toBe("-");
  });

  it("detects VIP from notes or company name", () => {
    expect(isVipCustomer(baseItem())).toBe(false);
    expect(isVipCustomer(baseItem({ notes: "VIP client" }))).toBe(true);
  });

  it("builds care flags for recurring and high-value customers", () => {
    const flags = resolveCustomerCareFlags(baseItem());
    expect(flags.map((f) => f.id)).toContain("recurring");
    expect(flags.map((f) => f.id)).toContain("high_value");
  });

  it("filters registry view chips", () => {
    const items = [
      baseItem({ customerId: "a", recurringCount: 1 }),
      baseItem({ customerId: "b", recurringCount: 0, notes: "VIP" }),
    ];
    const recurringOnly = filterAdminCustomersForRegistryView({
      items,
      view: "recurring",
    });
    expect(recurringOnly).toHaveLength(1);
    expect(recurringOnly[0]?.customerId).toBe("a");

    const vipOnly = filterAdminCustomersForRegistryView({
      items,
      view: "vip",
    });
    expect(vipOnly).toHaveLength(1);
    expect(vipOnly[0]?.customerId).toBe("b");
  });

  it("aggregates registry stats across all customers", () => {
    const stats = computeAdminCustomerRegistryStats([
      baseItem({ lifetimeValueCents: 10_000_00, recurringCount: 1 }),
      baseItem({ customerId: "cust-2", lifetimeValueCents: 5_000_00, recurringCount: 0 }),
    ]);
    expect(stats.totalCustomers).toBe(2);
    expect(stats.recurringCustomers).toBe(1);
    expect(stats.lifetimeValueCents).toBe(15_000_00);
  });

  it("builds card model with preferred cleaner footnote", () => {
    const model = buildAdminCustomerRegistryCardModel(baseItem());
    expect(model.href).toBe("/admin/customers/cust-1");
    expect(model.initials).toBe("NK");
    expect(model.footnote).toBe("Preferred · Sarah Khoza");
  });
});
