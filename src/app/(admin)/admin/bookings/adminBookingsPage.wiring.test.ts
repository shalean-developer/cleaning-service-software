import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("admin bookings page (2C-5)", () => {
  it("orders command-center-style surfaces before the list", () => {
    const source = readPage("src/app/(admin)/admin/bookings/page.tsx");
    const body = source.slice(source.indexOf("return ("));

    const queuesIndex = body.indexOf("<AdminBookingsQueuesSummary");
    const filtersIndex = body.indexOf("<AdminBookingsFilters");
    const rowIndex = body.indexOf("<AdminBookingListRow");

    expect(queuesIndex).toBeGreaterThan(-1);
    expect(filtersIndex).toBeGreaterThan(queuesIndex);
    expect(rowIndex).toBeGreaterThan(filtersIndex);
    expect(source).not.toContain("<AdminOperationalQueueStrip");
    expect(readPage("src/components/dashboard/AdminBookingsFilters.tsx")).toContain(
      "AdminBookingsFilterPresets",
    );
  });

  it("keeps operational guide behind details when queue filter active", () => {
    const source = readPage("src/components/dashboard/admin/AdminBookingsOperationalGuide.tsx");
    expect(source).toContain("<details");
    expect(source).toContain("Operational guide");
  });
});
