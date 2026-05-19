import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildAdminBookingsExportHref } from "@/features/dashboards/server/parseAdminBookingsQueryParams";
import { adminBookingsFooterCopy } from "./AdminBookingsFilters";

describe("adminBookingsFooterCopy", () => {
  it("shows uncapped match totals for server-side filters", () => {
    expect(
      adminBookingsFooterCopy({
        matchTotal: 37,
        returnedCount: 37,
        limit: 200,
        capped: false,
        hasActiveFilters: true,
      }),
    ).toBe("Showing 37 of 37 matching bookings.");
  });

  it("shows capped copy when matchTotal exceeds returnedCount", () => {
    expect(
      adminBookingsFooterCopy({
        matchTotal: 482,
        returnedCount: 200,
        limit: 200,
        capped: true,
        hasActiveFilters: true,
      }),
    ).toBe("Showing 200 of 482 matching bookings (newest 200 by last update).");
  });

  it("labels in-memory deferred filters as loaded subset", () => {
    expect(
      adminBookingsFooterCopy({
        matchTotal: null,
        returnedCount: 3,
        limit: 200,
        capped: true,
        subsetFiltered: true,
        hasActiveFilters: true,
      }),
    ).toBe("Showing 3 matching bookings in the newest 200 loaded by last update.");
  });

  it("shows up-to copy when no filters are active", () => {
    expect(
      adminBookingsFooterCopy({
        matchTotal: null,
        returnedCount: 200,
        limit: 200,
        capped: true,
        hasActiveFilters: false,
      }),
    ).toBe("Showing up to 200 bookings (newest by last update, limit 200).");
  });

  it("export href preserves current query params", () => {
    expect(
      buildAdminBookingsExportHref({
        filter: "payment_failed",
        search: "acme",
        scheduledFrom: "2026-05-01",
        scheduledTo: "2026-05-31",
      }),
    ).toBe(
      "/api/admin/export/bookings.csv?filter=payment_failed&q=acme&from=2026-05-01&to=2026-05-31",
    );
  });

  it("export href works with no filters", () => {
    expect(buildAdminBookingsExportHref({})).toBe("/api/admin/export/bookings.csv");
  });

  it("renders short-search helper without clearing the input", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/AdminBookingsFilters.tsx"),
      "utf8",
    );

    expect(source).toContain("Search uses 3 or more characters.");
    expect(source).toContain("isAdminBookingSearchIgnored");
    expect(source).toContain('defaultValue={search ?? ""}');
    expect(source).toContain("Advanced filters");
    expect(source).toContain("AdminBookingsFilterPresets");
  });
});
