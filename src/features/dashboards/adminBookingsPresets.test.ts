import { describe, expect, it } from "vitest";
import {
  ADMIN_BOOKINGS_PRESETS,
  adminBookingsPresetForFilter,
  isAdminBookingsPresetActive,
} from "./adminBookingsPresets";
import { buildAdminBookingsHref } from "./adminBookingsFilterUrl";

describe("adminBookingsPresets", () => {
  it("maps presets to existing filter query params", () => {
    expect(ADMIN_BOOKINGS_PRESETS.find((p) => p.id === "payment_issues")?.filter).toBe(
      "payment_failed",
    );
    expect(ADMIN_BOOKINGS_PRESETS.find((p) => p.id === "needs_attention")?.filter).toBe(
      "assignment_attention",
    );
    expect(ADMIN_BOOKINGS_PRESETS.find((p) => p.id === "paid_no_assignment")?.filter).toBe(
      "pending_assignment",
    );
    expect(ADMIN_BOOKINGS_PRESETS.find((p) => p.id === "deferred")?.filter).toBe(
      "dispatch_not_started",
    );
    expect(ADMIN_BOOKINGS_PRESETS.find((p) => p.id === "team_support")?.filter).toBe(
      "two_cleaner_request",
    );
  });

  it("buildAdminBookingsHref clears filter for All preset", () => {
    expect(
      buildAdminBookingsHref({ filter: "payment_failed" }, { filter: undefined }),
    ).toBe("/admin/bookings");
  });

  it("buildAdminBookingsHref preserves search when switching presets", () => {
    expect(
      buildAdminBookingsHref({ q: "acme" }, { filter: "assignment_attention" }),
    ).toBe("/admin/bookings?filter=assignment_attention&q=acme");
  });

  it("adminBookingsPresetForFilter resolves active preset", () => {
    expect(adminBookingsPresetForFilter("payment_failed")?.id).toBe("payment_issues");
    expect(adminBookingsPresetForFilter(undefined)?.id).toBe("all");
  });

  it("isAdminBookingsPresetActive marks All when no filter", () => {
    const all = ADMIN_BOOKINGS_PRESETS.find((p) => p.id === "all")!;
    expect(isAdminBookingsPresetActive(all, undefined)).toBe(true);
    expect(isAdminBookingsPresetActive(all, "payment_failed")).toBe(false);
  });
});
