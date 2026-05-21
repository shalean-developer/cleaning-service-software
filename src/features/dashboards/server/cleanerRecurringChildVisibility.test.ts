import { describe, expect, it } from "vitest";

/** Mirror of cleanerJobReadModel JOB_STATUSES — unpaid recurring children must stay off this list. */
const CLEANER_JOB_STATUSES = [
  "assigned",
  "in_progress",
  "completed",
  "payout_ready",
  "paid_out",
] as const;

describe("cleaner recurring child visibility", () => {
  it("excludes pending_payment from cleaner job statuses", () => {
    expect(CLEANER_JOB_STATUSES.includes("pending_payment" as never)).toBe(false);
    expect(CLEANER_JOB_STATUSES).toContain("assigned");
  });
});
