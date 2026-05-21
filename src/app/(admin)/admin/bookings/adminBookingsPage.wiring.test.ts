import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("admin bookings page (2C-5)", () => {
  it("orders operations toolbar before list and keeps advanced surfaces in extras", () => {
    const source = readPage("src/app/(admin)/admin/bookings/page.tsx");
    const body = source.slice(source.indexOf("return ("));

    const toolbarIndex = body.indexOf("<AdminBookingsOperationsToolbar");
    const listIndex = body.indexOf("<AdminBookingsOperationsList");
    const extrasIndex = body.indexOf("<AdminBookingsOperationsExtras");

    expect(toolbarIndex).toBeGreaterThan(-1);
    expect(listIndex).toBeGreaterThan(toolbarIndex);
    expect(extrasIndex).toBeGreaterThan(listIndex);
    expect(source).not.toContain("<AdminOperationalQueueStrip");
    expect(source).not.toContain("<AdminBookingListRow");
    expect(readPage("src/components/dashboard/admin/bookings/AdminBookingsOperationsExtras.tsx")).toContain(
      "AdminBookingsFilterPresets",
    );
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
