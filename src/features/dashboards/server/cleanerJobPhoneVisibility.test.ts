import { describe, expect, it } from "vitest";
import type { CleanerJobDetail } from "./types";

/** NF-3: cleaner surfaces must not expose customer contact phone. */
describe("cleaner job phone visibility policy", () => {
  it("CleanerJobDetail type has no customer phone fields", () => {
    const sample = {
      bookingId: "b1",
      status: "assigned",
      scheduledStart: "",
      scheduledEnd: "",
      scheduleLabel: "",
      locationSummary: "",
      serviceLabel: "",
      earningsCents: null,
      earningsLabel: "",
      updatedAt: "",
      timeline: [],
      homeSizeSummary: null,
      cleaningIntensityLabel: null,
      equipmentSupplyOperationalLabel: null,
      specialInstructions: null,
      earnings: [],
    } satisfies CleanerJobDetail;

    const keys = Object.keys(sample);
    expect(keys.some((k) => /phone|contact/i.test(k))).toBe(false);
  });
});
