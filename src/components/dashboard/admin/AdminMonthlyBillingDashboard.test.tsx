import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("admin monthly billing UI phase 2", () => {
  it("shows setup disabled notice in customer panel when flag off", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminCustomerBillingAccountPanel.tsx"),
      "utf8",
    );
    expect(panel).toMatch(/monthly-billing-setup-disabled-notice/);
    expect(panel).toMatch(/Monthly account billing setup is disabled/);
    expect(panel).toMatch(/monthly-billing-enable-button/);
    expect(panel).not.toMatch(/Generate invoice/i);
  });

  it("dashboard banner reflects setup flag", () => {
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyBillingDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toMatch(/monthly-billing-phase-banner/);
    expect(dashboard).toMatch(/AdminMonthlyBillingAccountRowActions/);
  });

  it("hides row actions when setup disabled via setupEnabled prop", () => {
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyBillingDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toMatch(/setupEnabled \?/);
  });

  it("shows invoice accrual section and disabled banner", () => {
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyBillingDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toMatch(/AdminMonthlyBillingAccrualSection/);
    expect(dashboard).toMatch(/invoiceReadinessLabel/);
    const accrualSection = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyBillingAccrualSection.tsx"),
      "utf8",
    );
    expect(accrualSection).toMatch(/monthly-billing-accrual-disabled-banner/);
    expect(accrualSection).toMatch(/Monthly invoice accrual is disabled/);
  });

  it("customer panel shows current month accrued batch", () => {
    const panel = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminCustomerBillingAccountPanel.tsx"),
      "utf8",
    );
    expect(panel).toMatch(/customer-current-month-accrued-batch/);
  });

  it("booking detail shows invoice accrual status", () => {
    const page = readFileSync(
      path.join(process.cwd(), "src/app/(admin)/admin/bookings/[bookingId]/page.tsx"),
      "utf8",
    );
    expect(page).toMatch(/AdminBookingInvoiceAccrualStatus/);
    expect(page).toMatch(/loadBookingInvoiceAccrualStatus/);
  });

  it("shows generate invoice action and generation disabled banner", () => {
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyBillingDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toMatch(/AdminMonthlyBillingBatchGenerateAction/);
    expect(dashboard).toMatch(/AdminMonthlyBillingGenerationSection/);
    const generateAction = readFileSync(
      path.join(
        process.cwd(),
        "src/components/dashboard/admin/AdminMonthlyBillingBatchGenerateAction.tsx",
      ),
      "utf8",
    );
    expect(generateAction).toMatch(/monthly-billing-generate-invoice-warning/);
    expect(generateAction).toMatch(/monthly-billing-generation-disabled/);
  });

  it("shows payment sync section and sync action", () => {
    const dashboard = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyBillingDashboard.tsx"),
      "utf8",
    );
    expect(dashboard).toMatch(/AdminMonthlyBillingPaymentSyncSection/);
    expect(dashboard).toMatch(/AdminMonthlyBillingBatchSyncAction/);
    const syncAction = readFileSync(
      path.join(process.cwd(), "src/components/dashboard/admin/AdminMonthlyBillingBatchSyncAction.tsx"),
      "utf8",
    );
    expect(syncAction).toMatch(/monthly-billing-sync-payment-/);
    expect(syncAction).toMatch(/monthly-billing-batch-paid/);
    expect(syncAction).toMatch(/monthly-billing-payment-sync-failed-alert/);
  });
});
