import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("admin payouts page (7P-1C)", () => {
  it("uses DashboardFetchError instead of a plain red paragraph on fetch failure", () => {
    const source = readPage("src/app/(admin)/admin/payouts/page.tsx");

    expect(source).toContain("DashboardFetchError");
    expect(source).toContain('dashboardFetchErrorTitle("payouts", "admin")');
    expect(source).toContain("description={result.message}");
    expect(source).not.toContain('className="text-sm text-red-600"');
  });

  it("keeps success-state payout summary and queue rendering", () => {
    const source = readPage("src/app/(admin)/admin/payouts/page.tsx");

    expect(source).toContain("formatZar(result.summary.pendingCents)");
    expect(source).toContain("Payout-ready queue");
    expect(source).toContain("No bookings awaiting payout");
    expect(source).toContain("getAdminPayoutSummary");
  });

  it("uses DashboardPageSkeleton while loading", () => {
    const loading = readPage("src/app/(admin)/admin/payouts/loading.tsx");

    expect(loading).toContain("DashboardPageSkeleton");
    expect(loading).toContain('variant="list"');
  });
});
