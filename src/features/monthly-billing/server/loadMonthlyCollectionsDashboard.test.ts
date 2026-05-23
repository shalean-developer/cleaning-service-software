import { describe, expect, it } from "vitest";
import { computeInvoiceAgingBucket } from "./monthlyInvoiceDeliveryTypes";

describe("collections dashboard aging buckets", () => {
  it("maps due dates into aging buckets", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    expect(computeInvoiceAgingBucket("2026-06-20", now)).toBe("current");
    expect(computeInvoiceAgingBucket("2026-06-01", now)).toBe("1-30");
    expect(computeInvoiceAgingBucket("2026-04-01", now)).toBe("61-90");
    expect(computeInvoiceAgingBucket("2026-01-01", now)).toBe("90+");
  });
});
