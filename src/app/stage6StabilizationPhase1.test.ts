import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isAdminBookingSearchIgnored } from "@/features/dashboards/server/adminBookingsListQuery";

function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function readComponent(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Stage 6 stabilization Phase 1 presentation fixes", () => {
  it("customer home shows fetch error before empty state", () => {
    const source = readPage("src/app/(customer)/customer/page.tsx");

    expect(source).toContain("DashboardFetchError");
    expect(source).toContain("!result.ok");
    expect(source).toContain('dashboardFetchErrorTitle("bookings", "customer")');
    expect(source).toContain("CustomerHomeContent");
    const recentActivity = readComponent(
      "src/components/dashboard/customer/CustomerHomeRecentActivity.tsx",
    );
    expect(recentActivity).toContain("stays.length");
    expect(source.indexOf("!result.ok")).toBeLessThan(source.indexOf("<CustomerHomeContent"));
  });

  it("admin bookings list uses DashboardFetchError on fetch failure", () => {
    const source = readPage("src/app/(admin)/admin/bookings/page.tsx");

    expect(source).toContain("DashboardFetchError");
    expect(source).toContain('dashboardFetchErrorTitle("bookings", "admin")');
    expect(source).not.toContain('className="text-sm text-red-600"');
  });

  it("cleaner earnings separates fetch failure from empty earnings", () => {
    const source = readPage("src/app/(cleaner)/cleaner/earnings/page.tsx");

    expect(source).toContain("DashboardFetchError");
    expect(source).toContain('!result.ok');
    expect(source).toContain('dashboardFetchErrorTitle("earnings", "cleaner")');
    expect(source).toContain("CLEANER_EARNINGS_EMPTY");
    expect(source).not.toContain("!result.ok || result.earnings.length === 0");
  });

  it("admin bookings filters show q<3 helper without clearing input", () => {
    const source = readComponent("src/components/dashboard/AdminBookingsFilters.tsx");

    expect(source).toContain("isAdminBookingSearchIgnored");
    expect(source).toContain("Search uses 3 or more characters.");
    expect(source).toContain('defaultValue={search ?? ""}');
  });

  it("isAdminBookingSearchIgnored detects short non-empty q", () => {
    expect(isAdminBookingSearchIgnored("ab")).toBe(true);
    expect(isAdminBookingSearchIgnored("  x ")).toBe(true);
    expect(isAdminBookingSearchIgnored("abc")).toBe(false);
    expect(isAdminBookingSearchIgnored(undefined)).toBe(false);
    expect(isAdminBookingSearchIgnored("")).toBe(false);
  });

  it("admin bookings operations list uses ops card builder", () => {
    const listPage = readPage("src/app/(admin)/admin/bookings/page.tsx");
    const badges = readComponent("src/features/dashboards/adminBookingListBadges.ts");

    const opsList = readComponent(
      "src/components/dashboard/admin/bookings/AdminBookingsOperationsList.tsx",
    );
    expect(listPage).toContain("<AdminBookingsOperationsList");
    expect(opsList).toContain("buildAdminBookingOpsCardModel");
    expect(badges).toContain('b.status !== "payment_failed"');
    expect(badges).toContain("labelForAdminPaymentFailureAttention");
  });

  it("admin detail matches list assignment visibility and payment badge dedupe", () => {
    const source = readPage("src/app/(admin)/admin/bookings/[bookingId]/page.tsx");

    expect(source).toContain("assignmentVisibilityKey ?? b.assignmentAttention");
    expect(source).toContain('b.status !== "payment_failed"');
    expect(source).toContain("labelForAdminPaymentFailureAttention");
    expect(source).not.toMatch(/assignmentAttention \? \([\s\S]*labelForAssignmentAttention\(b\.assignmentAttention\)/);
  });

  it("loading routes exist for customer home and cleaner job detail", () => {
    expect(() => readPage("src/app/(customer)/customer/loading.tsx")).not.toThrow();
    expect(() => readPage("src/app/(cleaner)/cleaner/jobs/[bookingId]/loading.tsx")).not.toThrow();

    const customerLoading = readPage("src/app/(customer)/customer/loading.tsx");
    const jobDetailLoading = readPage("src/app/(cleaner)/cleaner/jobs/[bookingId]/loading.tsx");

    expect(customerLoading).toContain("CustomerHubShell");
    expect(customerLoading).toContain("animate-pulse");
    expect(jobDetailLoading).toContain("DashboardPageSkeleton");
    expect(jobDetailLoading).toContain('variant="detail"');
  });
});
