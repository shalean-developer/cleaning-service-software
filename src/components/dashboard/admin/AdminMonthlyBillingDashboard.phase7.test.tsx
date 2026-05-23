import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin monthly billing UI phase 7", () => {
  it("shows month-end operations section and checklist", () => {
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyBillingDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toMatch(/AdminMonthlyBillingOperationsSection/);
    expect(dashboard).toMatch(/AdminMonthlyBillingMonthEndSection/);
    expect(dashboard).toMatch(/AdminMonthlyBillingBatchSendAction/);
    expect(dashboard).toMatch(/AdminMonthlyBillingBatchReminderAction/);
    expect(dashboard).toMatch(/AdminMonthlyBillingBatchMarkOverdueAction/);
  });

  it("groups batches into month-end review sections", () => {
    const section = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyBillingMonthEndSection.tsx"),
      "utf8",
    );
    expect(section).toMatch(/monthly-billing-generated-not-sent-section/);
    expect(section).toMatch(/monthly-billing-sent-awaiting-payment-section/);
    expect(section).toMatch(/monthly-billing-overdue-section/);
  });

  it("customer invoices page exposes monthly invoice list", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src/app/(customer)/customer/invoices/page.tsx"),
      "utf8",
    );
    expect(page).toMatch(/CustomerMonthlyInvoicesPanel/);
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/customer/CustomerMonthlyInvoicesPanel.tsx"),
      "utf8",
    );
    expect(panel).toMatch(/customer-monthly-invoice-pay-link/);
    expect(panel).not.toMatch(/audit/i);
  });
});
