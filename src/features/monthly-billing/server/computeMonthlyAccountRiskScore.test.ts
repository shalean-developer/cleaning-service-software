import { describe, expect, it } from "vitest";
import { computeMonthlyAccountRiskScore } from "./computeMonthlyAccountRiskScore";

describe("computeMonthlyAccountRiskScore", () => {
  it("increases risk with overdue invoices", () => {
    const low = computeMonthlyAccountRiskScore({
      overdueInvoiceCount: 0,
      averageDaysLate: 0,
      unpaidBalanceCents: 0,
      reminderCount: 0,
      disputedInvoiceCount: 0,
      failedDeliveryCount: 0,
      recentPaidCount30d: 0,
    });
    const high = computeMonthlyAccountRiskScore({
      overdueInvoiceCount: 3,
      averageDaysLate: 20,
      unpaidBalanceCents: 500000,
      reminderCount: 4,
      disputedInvoiceCount: 0,
      failedDeliveryCount: 0,
      recentPaidCount30d: 0,
    });
    expect(high.score).toBeGreaterThan(low.score);
  });

  it("lowers risk after recent payment", () => {
    const withoutPayment = computeMonthlyAccountRiskScore({
      overdueInvoiceCount: 1,
      averageDaysLate: 10,
      unpaidBalanceCents: 100000,
      reminderCount: 2,
      disputedInvoiceCount: 0,
      failedDeliveryCount: 0,
      recentPaidCount30d: 0,
    });
    const withPayment = computeMonthlyAccountRiskScore({
      overdueInvoiceCount: 1,
      averageDaysLate: 10,
      unpaidBalanceCents: 100000,
      reminderCount: 2,
      disputedInvoiceCount: 0,
      failedDeliveryCount: 0,
      recentPaidCount30d: 2,
    });
    expect(withPayment.score).toBeLessThan(withoutPayment.score);
  });

  it("recommends finance review when disputed", () => {
    const result = computeMonthlyAccountRiskScore({
      overdueInvoiceCount: 0,
      averageDaysLate: 0,
      unpaidBalanceCents: 0,
      reminderCount: 0,
      disputedInvoiceCount: 1,
      failedDeliveryCount: 0,
      recentPaidCount30d: 0,
    });
    expect(result.recommendation).toBe("finance_review");
  });
});
