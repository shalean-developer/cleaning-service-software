import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerBookingsEmptyState } from "@/components/dashboard/customer/CustomerBookingsEmptyState";
import { CustomerBookACleanCta } from "@/components/dashboard/customer/CustomerBookACleanCta";
import { emptyStateForCustomerBookingTab } from "./customerBookingsDashboardDisplay";

function readSource(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("customer bookings list surface (Phase 2B-2)", () => {
  it("keeps the full bookings list on /customer/bookings only", () => {
    const home = readSource("src/app/(customer)/customer/page.tsx");
    const bookings = readSource("src/app/(customer)/customer/bookings/page.tsx");

    expect(home).toContain("CustomerHomeContent");
    expect(home).not.toContain("CustomerBookingsListContent");
    expect(home).not.toContain("listCustomerBookings");
    expect(bookings).toContain("CustomerBookingsListContent");
    expect(bookings).toContain("listCustomerBookings");
  });

  it("bookings route does not duplicate inline list cards", () => {
    const bookings = readSource("src/app/(customer)/customer/bookings/page.tsx");

    expect(bookings).not.toContain("customerBookingListCardLayers");
    expect(bookings).not.toContain('<ul className="space-y-3">');
    expect(bookings).not.toContain("EmptyState");
  });

  it("dashboard renders CustomerBookingListCard for filtered results", () => {
    const dashboard = readSource(
      "src/components/dashboard/customer/CustomerBookingsDashboard.tsx",
    );

    expect(dashboard).toContain("CustomerBookingListCard");
    expect(dashboard).toContain("CustomerBookACleanCta");
  });

  it("empty states include Book a clean CTA", () => {
    const html = renderToStaticMarkup(
      <CustomerBookingsEmptyState
        title="No upcoming bookings"
        description="Scheduled cleans appear here after checkout."
        action={<CustomerBookACleanCta />}
      />,
    );

    expect(html).toContain("Book a clean");
    expect(html).toContain('href="/customer/book"');
  });

  it("tab empty copy remains available for filtered views", () => {
    expect(emptyStateForCustomerBookingTab("upcoming").title).toBe("No upcoming bookings");
    expect(emptyStateForCustomerBookingTab("completed").title).toBe("No completed bookings");
    expect(emptyStateForCustomerBookingTab("cancelled").title).toBe("No cancelled bookings");
    expect(emptyStateForCustomerBookingTab("unpaid").title).toBe("No unpaid bookings");
  });
});
