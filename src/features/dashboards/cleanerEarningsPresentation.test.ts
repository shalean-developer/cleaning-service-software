import { describe, expect, it } from "vitest";
import { summarizeCleanerEarningsForDisplay } from "./cleanerEarningsPresentation";
import type { CleanerEarningListItem } from "@/features/earnings/server/types";

function line(
  overrides: Partial<CleanerEarningListItem> & Pick<CleanerEarningListItem, "id">,
): CleanerEarningListItem {
  return {
    bookingId: "booking-a",
    grossAmountCents: 10_000,
    payoutAmountCents: 5_000,
    payoutStatus: "paid",
    serviceLabel: "Regular cleaning",
    scheduleLabel: "Mon 10:00",
    createdAt: "2026-05-01T10:00:00Z",
    ...overrides,
  };
}

describe("summarizeCleanerEarningsForDisplay", () => {
  it("returns zero totals for an empty list", () => {
    expect(summarizeCleanerEarningsForDisplay([])).toEqual({
      completedJobCount: 0,
      totalEarningsCents: 0,
    });
  });

  it("sums payout amounts and counts unique bookings", () => {
    const summary = summarizeCleanerEarningsForDisplay([
      line({ id: "line-1", bookingId: "booking-a", payoutAmountCents: 3_000 }),
      line({ id: "line-2", bookingId: "booking-a", payoutAmountCents: 2_000 }),
      line({ id: "line-3", bookingId: "booking-b", payoutAmountCents: 7_500 }),
    ]);

    expect(summary).toEqual({
      completedJobCount: 2,
      totalEarningsCents: 12_500,
    });
  });

  it("counts lines without booking id individually", () => {
    const summary = summarizeCleanerEarningsForDisplay([
      line({ id: "line-orphan", bookingId: null, payoutAmountCents: 1_000 }),
    ]);

    expect(summary.completedJobCount).toBe(1);
    expect(summary.totalEarningsCents).toBe(1_000);
  });
});
