import { describe, expect, it } from "vitest";
import { ADMIN_RUNBOOKS } from "@/features/dashboards/server/adminRunbooks";
import {
  ADMIN_OPERATIONAL_QUEUES,
  adminOperationalQueueHref,
  buildAdminOperationalQueueCards,
  buildAdminOperationalQueueContextCard,
  isAdminOperationalQueueFilter,
  labelForOperationalQueueSeverity,
} from "./adminOperationalQueues";

describe("adminOperationalQueues (7A-1 / 7A-2a)", () => {
  it("defines five booking-filter queues with stable deep links", () => {
    expect(ADMIN_OPERATIONAL_QUEUES).toHaveLength(5);
    expect(ADMIN_OPERATIONAL_QUEUES.map((q) => q.key)).toEqual([
      "needs_assignment",
      "dispatch_not_started",
      "recovery_needed",
      "payment_attention",
      "assignment_attention",
    ]);
    for (const queue of ADMIN_OPERATIONAL_QUEUES) {
      expect(adminOperationalQueueHref(queue.filter)).toBe(
        `/admin/bookings?filter=${queue.filter}`,
      );
    }
  });

  it("each queue has complete explainability fields (7A-2a)", () => {
    for (const queue of ADMIN_OPERATIONAL_QUEUES) {
      const { explainability } = queue;
      expect(explainability.summary.length).toBeGreaterThan(0);
      expect(explainability.whyHere.length).toBeGreaterThanOrEqual(2);
      expect(explainability.recommendedAction.length).toBeGreaterThan(0);
      expect(explainability.runbookKey in ADMIN_RUNBOOKS).toBe(true);
      if (explainability.secondaryRunbookKey) {
        expect(explainability.secondaryRunbookKey in ADMIN_RUNBOOKS).toBe(true);
      }
      expect(labelForOperationalQueueSeverity(explainability.severity)).toBeTruthy();
    }
  });

  it("buildAdminOperationalQueueContextCard returns null for non-operational filters (7A-2b)", () => {
    expect(
      buildAdminOperationalQueueContextCard("selected_declined", [
        {
          key: "needs_assignment",
          label: "Needs assignment",
          count: 1,
          href: "/admin/bookings?filter=pending_assignment",
          tone: "warning",
        },
      ]),
    ).toBeNull();
    expect(isAdminOperationalQueueFilter("recovery_needed")).toBe(true);
    expect(isAdminOperationalQueueFilter("selected_declined")).toBe(false);
  });

  it("buildAdminOperationalQueueCards merges counts with static copy", () => {
    const cards = buildAdminOperationalQueueCards([
      {
        key: "payment_attention",
        label: "Payment attention",
        count: 3,
        href: "/admin/bookings?filter=payment_failed",
        tone: "danger",
      },
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.severity).toBe("urgent");
    expect(cards[0]?.summary).toContain("payment failed");
    expect(cards[0]?.runbookKey).toBe("paymentFailedRetry");
  });
});
