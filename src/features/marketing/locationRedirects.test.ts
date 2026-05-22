import { describe, expect, it } from "vitest";
import { LOCATION_SEO_SLUGS } from "./marketing-routes";
import { LOCATION_SEO_SLUG_LIST } from "./locationSlugList";
import {
  buildLocationLegacyRedirects,
  legacyLocationPathFromSlug,
} from "./locationRedirects";

describe("locationRedirects", () => {
  it("slug list stays aligned with marketing routes", () => {
    expect([...LOCATION_SEO_SLUG_LIST]).toEqual([...LOCATION_SEO_SLUGS]);
  });

  it("generates one permanent redirect per canonical slug", () => {
    const redirects = buildLocationLegacyRedirects();
    expect(redirects).toHaveLength(LOCATION_SEO_SLUG_LIST.length);
    expect(redirects.every((r) => r.permanent === true)).toBe(true);
  });

  it("maps legacy short paths to canonical -cape-town slugs", () => {
    const redirects = buildLocationLegacyRedirects();
    const seaPoint = redirects.find((r) => r.source === "/locations/sea-point");
    expect(seaPoint?.destination).toBe("/locations/sea-point-cape-town");
  });

  it("does not create redirect chains (destination is canonical)", () => {
    const redirects = buildLocationLegacyRedirects();
    for (const rule of redirects) {
      expect(rule.destination).toMatch(/-cape-town$/);
      expect(rule.source).not.toBe(rule.destination);
    }
  });

  it("legacy path helper strips cape-town suffix", () => {
    expect(legacyLocationPathFromSlug("claremont-cape-town")).toBe(
      "/locations/claremont",
    );
  });
});
