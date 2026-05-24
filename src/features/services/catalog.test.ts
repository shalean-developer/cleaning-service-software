import { describe, expect, it } from "vitest";
import {
  BOOKABLE_CORE_SERVICES,
  CORE_SERVICE_CATALOGUE,
  CORE_SERVICE_SLUGS,
  getCoreServiceBySlug,
} from "./catalog";

describe("core service catalogue", () => {
  it("contains the six Shalean foundation services", () => {
    expect(CORE_SERVICE_SLUGS).toEqual([
      "standard-home-cleaning",
      "deep-cleaning",
      "move-in-move-out-cleaning",
      "office-cleaning",
      "carpet-cleaning",
      "post-construction-cleaning",
    ]);
    expect(CORE_SERVICE_CATALOGUE).toHaveLength(6);
  });

  it("keeps every service route-ready with booking availability explicit", () => {
    for (const service of CORE_SERVICE_CATALOGUE) {
      expect(service.seoPath).toMatch(/^\/services\//);
      expect(service.title).toBeTruthy();
      expect(service.shortDescription).toBeTruthy();
      expect(service.displayCopy).toContain("Cape Town");
      expect(typeof service.availableForBooking).toBe("boolean");
    }

    expect(BOOKABLE_CORE_SERVICES.map((service) => service.slug)).not.toContain(
      "post-construction-cleaning",
    );
  });

  it("resolves known slugs and rejects unknown ones", () => {
    expect(getCoreServiceBySlug("office-cleaning")?.title).toBe("Office Cleaning");
    expect(getCoreServiceBySlug("airbnb-cleaning")).toBeNull();
  });
});
