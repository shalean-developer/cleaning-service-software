import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin monthly governance dashboard phase 10", () => {
  it("exposes filters, bulk actions, timeline, and exports", () => {
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyGovernanceDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toMatch(/monthly-governance-filters/);
    expect(dashboard).toMatch(/monthly-governance-bulk-actions/);
    expect(dashboard).toMatch(/monthly-governance-credit-utilization/);
    expect(dashboard).toMatch(/monthly-governance-override-badge/);
    expect(dashboard).toMatch(/monthly-governance-internal-alerts/);
    expect(dashboard).toMatch(/Export selected CSV/);
    expect(dashboard).not.toMatch(/Bulk suspend accounts/);
  });

  it("renders governance timeline component", () => {
    const timeline = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyGovernanceTimeline.tsx"),
      "utf8",
    );
    expect(timeline).toMatch(/monthly-governance-timeline/);
    expect(timeline).toMatch(/monthly-governance-timeline-event/);
  });

  it("customer billing panel includes governance section", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminCustomerBillingAccountPanel.tsx"),
      "utf8",
    );
    expect(panel).toMatch(/AdminCustomerGovernancePanel/);
    const governancePanel = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminCustomerGovernancePanel.tsx"),
      "utf8",
    );
    expect(governancePanel).toMatch(/customer-governance-panel/);
  });
});

describe("monthly billing governance API routes phase 10", () => {
  it("governance route supports csv/json export", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/monthly-billing/governance/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/buildMonthlyGovernanceCsv/);
    expect(source).toMatch(/exportType === "csv"/);
    expect(source).toMatch(/exportType === "json"/);
  });

  it("bulk governance route requires admin POST", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/app/api/admin/monthly-billing/governance/bulk/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/requireApiUser\(\["admin"\]\)/);
    expect(source).toMatch(/executeMonthlyGovernanceBulkAction/);
  });

  it("finance review route validates confirmAction", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/app/api/admin/monthly-billing/accounts/[customerId]/finance-review/route.ts",
      ),
      "utf8",
    );
    expect(source).toMatch(/parseUpdateMonthlyAccountFinanceReviewBody/);
    expect(source).toMatch(/updateMonthlyAccountFinanceReview/);
  });

  it("governance timeline route is admin-only GET", () => {
    const source = readFileSync(
      path.join(
        process.cwd(),
        "src/app/api/admin/monthly-billing/accounts/[customerId]/governance-timeline/route.ts",
      ),
      "utf8",
    );
    expect(source).toMatch(/loadMonthlyGovernanceTimelineForCustomer/);
    expect(source).toMatch(/requireApiUser\(\["admin"\]\)/);
  });
});
