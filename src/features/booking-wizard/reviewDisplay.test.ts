import { describe, expect, it } from "vitest";
import {
  formatBedroomBathroomSummary,
  formatExtraRoomsSummary,
  formatCleanerPreference,
  formatSelectedAddons,
  formatSuburbLocation,
  getEquipmentSupplyCustomerLabel,
  getEquipmentSupplyExplanation,
  getEquipmentSupplyOperationalLabel,
  getFrequencyLabel,
  getTeamSupportCleanerNote,
  getTeamSupportCustomerLabel,
  getTeamSupportExplanation,
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

  it("formats regular-cleaning add-ons with service-specific labels", () => {
    expect(
      formatSelectedAddons(["laundry", "inside-oven"], "regular-cleaning"),
    ).toBe("Inside oven, Ironing & Laundry");
    expect(formatSelectedAddons(["balcony"], "regular-cleaning")).toBe("Balcony");
  });

  it("formats cleaner preference", () => {
    expect(formatCleanerPreference("best_available", null)).toBe("Best available");
    expect(formatCleanerPreference("selected", "Sam N.")).toBe("Sam N.");
  });

  it("formats suburb and city", () => {
    expect(formatSuburbLocation("Sea Point", "Cape Town")).toBe("Sea Point, Cape Town");
    expect(formatSuburbLocation("", "")).toBe("\u2014");
  });

  it("formats extra rooms summary", () => {
    expect(formatExtraRoomsSummary(0)).toBeNull();
    expect(formatExtraRoomsSummary(1)).toBe("1 extra room");
    expect(formatExtraRoomsSummary(3)).toBe("3 extra rooms");
  });

  it("formats bedroom and bathroom summaries for residential services", () => {
    expect(
      formatBedroomBathroomSummary("regular-cleaning", 2, 1, null),
    ).toEqual({
      bedroomsLabel: "2 bedrooms",
      bathroomsLabel: "1 bathroom",
    });
  });

  it("formats equipment supply labels", () => {
    expect(getEquipmentSupplyCustomerLabel("customer")).toBe("Customer-provided");
    expect(getEquipmentSupplyCustomerLabel("shalean")).toBe("Shalean-provided");
    expect(getEquipmentSupplyOperationalLabel("shalean")).toBe("Bring cleaning equipment");
    expect(getEquipmentSupplyOperationalLabel("customer")).toBe("Customer provides supplies");
    expect(getEquipmentSupplyExplanation("customer")).toBeNull();
    expect(getEquipmentSupplyExplanation("shalean")).toMatch(/Shalean cleaning supplies/);
  });

  it("formats team support labels for customer and cleaner", () => {
    expect(getTeamSupportCustomerLabel(1)).toBe("1 cleaner");
    expect(getTeamSupportCustomerLabel(2)).toBe("Request 2 cleaners");
    expect(getTeamSupportExplanation(1)).toBeNull();
    expect(getTeamSupportExplanation(2)).toMatch(/confirm team availability/);
    expect(getTeamSupportCleanerNote(1)).toBeNull();
    expect(getTeamSupportCleanerNote(2)).toBe(
      "Team support requested. Coordinate arrival with operations if needed.",
    );
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
