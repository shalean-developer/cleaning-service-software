import { describe, expect, it } from "vitest";
import { resolveBookPageServiceSlug } from "@/features/booking-wizard/bookServiceRoute";
import { WIZARD_SERVICE_OPTIONS } from "@/features/booking-wizard/constants";
import { CLEANER_CAPABILITY_OPTIONS } from "@/features/cleaners/admin/cleanerCapabilityOptions";
import { SERVICE_CATALOG } from "./catalog";
import { SERVICE_SLUGS } from "./types";

describe("service slug registry", () => {
  it("keeps SERVICE_SLUGS, catalog, wizard, and cleaner capabilities aligned", () => {
    expect(Object.keys(SERVICE_CATALOG).sort()).toEqual([...SERVICE_SLUGS].sort());

    const wizardSlugs = WIZARD_SERVICE_OPTIONS.filter((o) => o.enabled)
      .map((o) => o.slug)
      .sort();
    const capabilitySlugs = CLEANER_CAPABILITY_OPTIONS.map((o) => o.slug).sort();

    expect(wizardSlugs).toEqual([...SERVICE_SLUGS].sort());
    expect(capabilitySlugs).toEqual([...SERVICE_SLUGS].sort());
  });

  it("accepts every catalog slug on the customer book route", () => {
    for (const slug of SERVICE_SLUGS) {
      expect(resolveBookPageServiceSlug(slug)).toBe(slug);
    }
  });

  it("rejects common legacy or alternate marketing slug variants", () => {
    for (const slug of [
      "move-in-out-cleaning",
      "same-day-cleaning",
      "standard-cleaning",
    ]) {
      expect(resolveBookPageServiceSlug(slug)).toBeNull();
    }
  });
});
