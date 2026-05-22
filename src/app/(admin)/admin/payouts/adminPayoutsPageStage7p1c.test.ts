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

  it("loads real earnings data on success", () => {
    const source = readPage("src/app/(admin)/admin/payouts/page.tsx");

    expect(source).toContain("loadAdminEarningsView");
    expect(source).toContain("AdminEarningsView");
    expect(source).not.toContain("buildAdminEarningsView");
  });

  it("uses DashboardPageSkeleton while loading", () => {
    const loading = readPage("src/app/(admin)/admin/payouts/loading.tsx");

    expect(loading).toContain("DashboardPageSkeleton");
    expect(loading).toContain('variant="detail"');
  });
});
