import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("monthly billing phase 4 completion hook", () => {
  it("calls accrual after MARK_BOOKING_COMPLETED earnings for monthly_account", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/bookings/server/commands/executeBookingCommand.ts"),
      "utf8",
    );
    expect(source).toMatch(/runPostCompletionMonthlyInvoiceAccrual/);
    expect(source).toMatch(/isMonthlyAccountBillingMetadata\(.*metadata\)/);
    expect(source).toMatch(/recordEarningsForBooking/);
    const completionBlock = source.slice(
      source.indexOf('case "MARK_BOOKING_COMPLETED"'),
      source.indexOf('case "MARK_BOOKING_PAYOUT_READY"'),
    );
    const earningsIndex = completionBlock.indexOf("recordEarningsForBooking");
    const accrualIndex = completionBlock.indexOf("runPostCompletionMonthlyInvoiceAccrual");
    expect(accrualIndex).toBeGreaterThan(earningsIndex);
  });

  it("does not block completion when accrual throws", () => {
    const source = readFileSync(
      path.join(process.cwd(), "src/features/bookings/server/commands/executeBookingCommand.ts"),
      "utf8",
    );
    expect(source).toMatch(/runPostCompletionMonthlyInvoiceAccrual\(.*\)\.catch\(\(\) => undefined\)/);
  });
});
