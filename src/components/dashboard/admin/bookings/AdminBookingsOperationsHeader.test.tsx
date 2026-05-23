import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingsOperationsHeader } from "./AdminBookingsOperationsHeader";
import { ADMIN_BOOKING_CREATE_PATH } from "@/features/dashboards/adminNav";

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("AdminBookingsOperationsHeader", () => {
  it("renders compact Create booking in the header action row", () => {
    const html = renderToStaticMarkup(
      <AdminBookingsOperationsHeader shownCount={3} draftBookingEnabled={false} />,
    );

    expect(html).toContain('data-testid="admin-bookings-create-booking"');
    expect(html).toContain("Create booking");
    expect(html).toContain(`href="${ADMIN_BOOKING_CREATE_PATH}"`);
    expect(html).toContain("3 shown");
    expect(html).toContain("Preview mode until admin-assisted booking is enabled.");
    expect(html).not.toContain("Draft creation disabled");
  });

  it("omits preview tooltip when draft booking is enabled", () => {
    const html = renderToStaticMarkup(
      <AdminBookingsOperationsHeader shownCount={1} draftBookingEnabled />,
    );

    expect(html).not.toContain("Preview mode until admin-assisted booking is enabled.");
  });

  it("keeps the action row responsive for mobile (stacked header layout)", () => {
    const source = readSource("src/components/dashboard/admin/bookings/AdminBookingsOperationsHeader.tsx");
    expect(source).toContain("flex-col gap-3 lg:flex-row");
    expect(source).toContain("min-h-9");
  });
});
