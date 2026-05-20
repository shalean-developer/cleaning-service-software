import { describe, expect, it } from "vitest";
import {
  buildCarpetReviewHeroSegments,
  CARPET_CHECKOUT_WHAT_HAPPENS_NEXT,
  formatCarpetZonesLabel,
  getCarpetCleaningCheckoutCopy,
  getCarpetCleaningReviewCopy,
  getCarpetCleaningStepCopy,
  isCarpetCleaningSlug,
} from "./carpetCleaningDisplay";

describe("carpetCleaningDisplay", () => {
  it("identifies carpet-cleaning slug", () => {
    expect(isCarpetCleaningSlug("carpet-cleaning")).toBe(true);
    expect(isCarpetCleaningSlug("regular-cleaning")).toBe(false);
  });

  it("exposes floor-care step copy", () => {
    const step = getCarpetCleaningStepCopy("carpet-cleaning");
    expect(step?.detailsIntro.title).toBe("Carpet scope");
    expect(step?.zonesFieldLabel).toBe("Carpeted rooms");
    expect(step?.zonesFieldHint).toBe("Select 1–6");
    expect(step?.addonsTitle).toBe("Carpet add-ons");
    expect(step?.notesPlaceholder).toMatch(/ventilation/i);
    expect(step?.cleaner.title).toMatch(/carpet/i);
  });

  it("builds review hero without bedroom wording", () => {
    const review = getCarpetCleaningReviewCopy("carpet-cleaning");
    expect(review?.zonesRowLabel).toBe("Carpet zones");
    const segments = buildCarpetReviewHeroSegments({
      scheduleLabel: "Mon 10:00",
      locationLabel: "Sea Point",
      zonesSummary: formatCarpetZonesLabel(2),
      addonSummary: "Wall spot treatment",
      frequencyLabel: "One-time carpet refresh",
    });
    expect(segments.join(" ")).not.toMatch(/bedroom|bathroom/i);
    expect(segments.some((s) => s.includes("carpet zone"))).toBe(true);
  });

  it("checkout copy mentions carpet scheduling", () => {
    const checkout = getCarpetCleaningCheckoutCopy("carpet-cleaning");
    expect(checkout?.whatHappensNext).toEqual(CARPET_CHECKOUT_WHAT_HAPPENS_NEXT);
    expect(checkout?.floorCareNote).toMatch(/drying/i);
  });

  it("returns null for non-carpet slugs", () => {
    expect(getCarpetCleaningStepCopy("moving-cleaning")).toBeNull();
    expect(getCarpetCleaningReviewCopy("airbnb-cleaning")).toBeNull();
    expect(getCarpetCleaningCheckoutCopy("deep-cleaning")).toBeNull();
  });
});
