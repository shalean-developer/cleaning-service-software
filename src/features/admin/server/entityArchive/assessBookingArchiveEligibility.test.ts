import { describe, expect, it } from "vitest";
import { assessBookingArchiveEligibility } from "@/features/admin/adminEntityArchiveEligibility";

describe("assessBookingArchiveEligibility", () => {
  it("allows archive for draft without payment", () => {
    const result = assessBookingArchiveEligibility({
      deletedAt: null,
      status: "draft",
      paymentStatus: null,
      hasEarningLines: false,
    });
    expect(result.canArchive).toBe(true);
    expect(result.deleteBlockedMessage).toBeNull();
  });

  it("shows financial history message when paid", () => {
    const result = assessBookingArchiveEligibility({
      deletedAt: null,
      status: "confirmed",
      paymentStatus: "paid",
      hasEarningLines: false,
    });
    expect(result.canArchive).toBe(true);
    expect(result.deleteBlockedMessage).toContain("Archive");
  });

  it("blocks archive when assigned", () => {
    const result = assessBookingArchiveEligibility({
      deletedAt: null,
      status: "assigned",
      paymentStatus: "paid",
      hasEarningLines: false,
    });
    expect(result.canArchive).toBe(false);
    expect(result.deleteBlockedMessage).toContain("assigned or in progress");
  });
});
