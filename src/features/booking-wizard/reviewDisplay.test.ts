import { describe, expect, it } from "vitest";
import {
  formatBedroomBathroomSummary,
  formatCompactBedBathSummary,
  formatExtraRoomsSummary,
  formatCleanerPreference,
  formatSelectedAddons,
  buildCompactReviewHeroSegments,
  formatSuburbLocation,
  getSelectedAddonLabels,
  getEquipmentSupplyCustomerLabel,
  getEquipmentSupplyExplanation,
  getEquipmentSupplyOperationalLabel,
  getFrequencyLabel,
  getTeamSupportCleanerNote,
  getTeamSupportCustomerDashboardLabel,
  getTeamSupportCustomerLabel,
  getReviewNextStepsNote,
  getTeamSupportExplanation,
  getTeamSupportReviewSummaryLabel,
  TEAM_SUPPORT_LINE_ITEM_LABEL,
} from "./reviewDisplay";

describe("reviewDisplay", () => {
  it("formats review next-steps reassurance", () => {
    expect(getReviewNextStepsNote()).toMatch(/Paystack/);
    expect(getReviewNextStepsNote()).toMatch(/assign a cleaner/);
  });

  it("formats frequency labels from step options", () => {
    expect(getFrequencyLabel("weekly")).toBe("Weekly");
    expect(getFrequencyLabel("once")).toBe("Once-off");
  });

  it("formats add-ons in catalog display order", () => {
    expect(formatSelectedAddons([])).toBe("None");
    expect(formatSelectedAddons(["laundry", "balcony"])).toBe("Laundry, Balcony cleaning");
    expect(getSelectedAddonLabels(["laundry", "balcony"])).toEqual(["Laundry", "Balcony cleaning"]);
  });

  it("formats compact bed and bath summary", () => {
    expect(formatCompactBedBathSummary("regular-cleaning", 2, 1, null)).toBe("2 beds · 1 bath");
    expect(
      formatCompactBedBathSummary("office-cleaning", 0, 0, 120, {
        officeSizeTier: "medium",
        officeWorkstations: "15",
      }),
    ).toBe("Medium office · 15 workstations");
  });

  it("formats regular-cleaning add-ons with service-specific labels", () => {
    expect(
      formatSelectedAddons(["laundry", "inside-oven"], "regular-cleaning"),
    ).toBe("Inside oven, Ironing & Laundry");
    expect(formatSelectedAddons(["balcony"], "regular-cleaning")).toBe("Balcony cleaning");
  });

  it("formats cleaner preference", () => {
    expect(formatCleanerPreference("best_available", null)).toBe("Best available");
    expect(formatCleanerPreference("selected", "Sam N.")).toBe("Sam N.");
  });

  it("formats suburb and city", () => {
    expect(formatSuburbLocation("Sea Point", "Cape Town")).toBe("Sea Point, Cape Town");
    expect(formatSuburbLocation("Kenilworth", "Kenilworth")).toBe("Kenilworth");
    expect(formatSuburbLocation("", "")).toBe("\u2014");
  });

  it("builds compact review hero without duplicates or empty segments", () => {
    expect(
      buildCompactReviewHeroSegments(
        "Wed, 20 May 2026, 14:00",
        "Kenilworth",
        "Kenilworth",
        "Large office",
        null,
        "",
        "\u2014",
      ),
    ).toEqual(["Wed, 20 May 2026, 14:00", "Kenilworth", "Large office"]);
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
    expect(TEAM_SUPPORT_LINE_ITEM_LABEL).toBe("Team support request");
    expect(getTeamSupportCustomerLabel(1)).toBe("1 cleaner");
    expect(getTeamSupportCustomerLabel(2)).toBe("Team support requested");
    expect(getTeamSupportReviewSummaryLabel(1)).toBeNull();
    expect(getTeamSupportReviewSummaryLabel(2)).toBe("Request team support");
    expect(getTeamSupportExplanation(1)).toBeNull();
    expect(getTeamSupportExplanation(2)).toMatch(/confirm team availability/);
    expect(getTeamSupportExplanation(2)).toMatch(/faster clean when available/);
    expect(getTeamSupportCleanerNote(1)).toBeNull();
    expect(getTeamSupportCleanerNote(2)).toBe(
      "Team support requested. Coordinate arrival with operations if needed.",
    );
  });

  it("formats customer dashboard team support status from fulfillment", () => {
    expect(getTeamSupportCustomerDashboardLabel(null)).toBe(
      "Team support requested — awaiting confirmation",
    );
    expect(
      getTeamSupportCustomerDashboardLabel({ fulfilledCleanerCount: 2 }),
    ).toBe("Team support confirmed — 2 cleaners");
    expect(
      getTeamSupportCustomerDashboardLabel({ fulfilledCleanerCount: 1 }),
    ).toBe("Team support confirmed — 1 cleaner");
  });

  it("formats office property size instead of beds and baths", () => {
    expect(
      formatBedroomBathroomSummary("office-cleaning", 0, 0, 120, {
        officeSizeTier: "medium",
        officeWorkstations: "15",
      }),
    ).toEqual({
      bedroomsLabel: null,
      bathroomsLabel: "Medium office · 15 workstations",
    });
  });
});
