import { describe, expect, it } from "vitest";
import { showFrequencyForService } from "./frequencyVisibility";

describe("showFrequencyForService", () => {
  it("shows frequency for recurring-capable services", () => {
    expect(showFrequencyForService("regular-cleaning")).toBe(true);
    expect(showFrequencyForService("airbnb-cleaning")).toBe(true);
    expect(showFrequencyForService("office-cleaning")).toBe(true);
  });

  it("hides frequency for one-time or fixed-scope services", () => {
    expect(showFrequencyForService("deep-cleaning")).toBe(false);
    expect(showFrequencyForService("moving-cleaning")).toBe(false);
    expect(showFrequencyForService("carpet-cleaning")).toBe(false);
  });

  it("returns false when service is not selected", () => {
    expect(showFrequencyForService(null)).toBe(false);
    expect(showFrequencyForService(undefined)).toBe(false);
  });
});
