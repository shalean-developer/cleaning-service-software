import { describe, expect, it } from "vitest";
import {
  formatBedroomBathroomSummary,
  formatCleanerPreference,
  formatSelectedAddons,
  formatSuburbLocation,
  getFrequencyLabel,
} from "./reviewDisplay";

describe("reviewDisplay", () => {
  it("formats frequency labels from step options", () => {
    expect(getFrequencyLabel("weekly")).toBe("Weekly");
    expect(getFrequencyLabel("once")).toBe("Once-off");
  });

  it("formats add-ons in catalog display order", () => {
    expect(formatSelectedAddons([])).toBe("None");
    expect(formatSelectedAddons(["laundry", "balcony"])).toBe("Laundry, Balcony");
  });

  it("formats cleaner preference", () => {
    expect(formatCleanerPreference("best_available", null)).toBe("Best available");
    expect(formatCleanerPreference("selected", "Sam N.")).toBe("Sam N.");
  });

  it("formats suburb and city", () => {
    expect(formatSuburbLocation("Sea Point", "Cape Town")).toBe("Sea Point, Cape Town");
    expect(formatSuburbLocation("", "")).toBe("\u2014");
  });

  it("formats bedroom and bathroom summaries for residential services", () => {
    expect(
      formatBedroomBathroomSummary("regular-cleaning", 2, 1, null),
    ).toEqual({
      bedroomsLabel: "2 bedrooms",
      bathroomsLabel: "1 bathroom",
    });
  });

  it("formats office property size instead of beds and baths", () => {
    expect(
      formatBedroomBathroomSummary("office-cleaning", 0, 0, 120),
    ).toEqual({
      bedroomsLabel: null,
      bathroomsLabel: "120 sqm",
    });
  });
});
