import { describe, expect, it } from "vitest";
import { resolveBillingMonthFromInstant, resolveVisitDateFromInstant } from "./resolveBillingMonth";

describe("resolveBillingMonth", () => {
  it("uses Africa/Johannesburg local month", () => {
    // 2026-05-31 22:00 UTC = 2026-06-01 00:00 in Johannesburg (UTC+2)
    expect(resolveBillingMonthFromInstant("2026-05-31T22:00:00.000Z")).toBe("2026-06-01");
    expect(resolveVisitDateFromInstant("2026-05-31T22:00:00.000Z")).toBe("2026-06-01");
  });

  it("returns null for invalid instant", () => {
    expect(resolveBillingMonthFromInstant("not-a-date")).toBeNull();
  });
});
