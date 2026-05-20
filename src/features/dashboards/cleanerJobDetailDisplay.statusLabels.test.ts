import { describe, expect, it } from "vitest";
import { resolveCleanerJobStatusLabel } from "./cleanerJobDetailDisplay";

describe("resolveCleanerJobStatusLabel (Sprint A)", () => {
  it("uses service-specific completed label on list and detail paths", () => {
    expect(
      resolveCleanerJobStatusLabel("completed", { serviceLabel: "Airbnb Cleaning" }),
    ).toBe("Turnover completed");
    expect(
      resolveCleanerJobStatusLabel("payout_ready", { serviceLabel: "Airbnb Cleaning" }),
    ).toBe("Turnover completed");
  });

  it("falls back to generic cleaner labels for non-specialty services", () => {
    expect(resolveCleanerJobStatusLabel("assigned", { serviceLabel: "Regular Cleaning" })).toBe(
      "Scheduled",
    );
    expect(
      resolveCleanerJobStatusLabel("in_progress", { serviceLabel: "Regular Cleaning" }),
    ).toBe("In progress");
  });
});
