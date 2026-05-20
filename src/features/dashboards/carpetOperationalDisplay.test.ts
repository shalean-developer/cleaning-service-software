import { describe, expect, it } from "vitest";
import {
  getCarpetCleanerJobGuidanceSteps,
  isCarpetOperationalBooking,
  mapAdminBookingHeroRowsForCarpet,
} from "./carpetOperationalDisplay";

describe("carpetOperationalDisplay", () => {
  it("identifies carpet operational bookings", () => {
    expect(isCarpetOperationalBooking({ serviceSlug: "carpet-cleaning" })).toBe(true);
    expect(isCarpetOperationalBooking({ serviceLabel: "Carpet Cleaning" })).toBe(true);
    expect(isCarpetOperationalBooking({ serviceSlug: "moving-cleaning" })).toBe(false);
  });

  it("maps admin hero rows to carpet zones", () => {
    const rows = mapAdminBookingHeroRowsForCarpet([
      { label: "Home size", value: "2 bedrooms · 1 bathroom" },
      { label: "Notes", value: "Stain on lounge" },
    ]);
    expect(rows[0]?.label).toBe("Carpet zones");
  });

  it("provides cleaner guidance for assigned jobs", () => {
    const steps = getCarpetCleanerJobGuidanceSteps("assigned");
    expect(steps?.length).toBeGreaterThan(0);
    expect(steps?.some((s) => s.title.toLowerCase().includes("stain"))).toBe(true);
  });
});
