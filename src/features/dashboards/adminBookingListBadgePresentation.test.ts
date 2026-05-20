import { describe, expect, it } from "vitest";
import {
  presentAdminBookingListBadges,
  priorityScoreForAdminBookingBadge,
} from "./adminBookingListBadgePresentation";

describe("presentAdminBookingListBadges", () => {
  it("shows at most two badges plus overflow count", () => {
    const badges = [
      { label: "Payment confirmed", tone: "info" as const },
      { label: "Paid", tone: "success" as const },
      { label: "Finding cleaner", tone: "warning" as const },
      { label: "Airbnb turnover", tone: "neutral" as const },
    ];

    const result = presentAdminBookingListBadges(badges);
    expect(result.visible).toHaveLength(2);
    expect(result.overflowCount).toBe(2);
  });

  it("prioritizes payment problems over service badges", () => {
    const badges = [
      { label: "Airbnb turnover", tone: "neutral" as const },
      { label: "Payment failed", tone: "danger" as const },
      { label: "Paid", tone: "success" as const },
    ];

    const result = presentAdminBookingListBadges(badges);
    expect(result.visible.map((b) => b.label)).toContain("Payment failed");
    expect(result.overflowCount).toBe(1);
  });

  it("returns all badges when within limit", () => {
    const badges = [
      { label: "Finding cleaner", tone: "warning" as const },
      { label: "Paid", tone: "success" as const },
    ];
    const result = presentAdminBookingListBadges(badges);
    expect(result.visible).toHaveLength(2);
    expect(result.overflowCount).toBe(0);
  });
});

describe("priorityScoreForAdminBookingBadge", () => {
  it("ranks payment failure above assignment and service labels", () => {
    const payment = priorityScoreForAdminBookingBadge({
      label: "Payment failed",
      tone: "danger",
    });
    const assignment = priorityScoreForAdminBookingBadge({
      label: "Offer sent — awaiting acceptance",
      tone: "warning",
    });
    const service = priorityScoreForAdminBookingBadge({
      label: "Same-day turnover",
      tone: "warning",
    });
    expect(payment).toBeGreaterThan(assignment);
    expect(assignment).toBeGreaterThan(service);
  });
});
