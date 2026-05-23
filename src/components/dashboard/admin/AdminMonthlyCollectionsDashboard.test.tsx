import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin monthly collections dashboard phase 8", () => {
  it("exposes collections sections and aging buckets", () => {
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyCollectionsDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toMatch(/monthly-collections-aging-buckets/);
    expect(dashboard).toMatch(/monthly-collections-overdue-section/);
    expect(dashboard).toMatch(/monthly-collections-high-risk-section/);
    expect(dashboard).toMatch(/Export summary CSV/);
  });

  it("registers admin collections page route", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src/app/(admin)/admin/operations/monthly-collections/page.tsx"),
      "utf8",
    );
    expect(page).toMatch(/AdminMonthlyCollectionsDashboard/);
    expect(page).toMatch(/loadMonthlyCollectionsDashboard/);
  });
});
