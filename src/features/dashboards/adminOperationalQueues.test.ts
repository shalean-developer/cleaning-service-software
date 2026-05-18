import { describe, expect, it } from "vitest";
import {
  ADMIN_OPERATIONAL_QUEUES,
  adminOperationalQueueHref,
} from "./adminOperationalQueues";

describe("adminOperationalQueues (7A-1)", () => {
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
});
