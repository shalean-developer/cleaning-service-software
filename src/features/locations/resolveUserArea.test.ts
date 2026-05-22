import { describe, expect, it, vi } from "vitest";
import {
  buildResolvedUserArea,
  formatUserAreaDisplay,
  getCachedUserArea,
  isCachedUserAreaValid,
  isUnusableGeocodeAreaName,
  parseNominatimReversePayload,
  pickAreaFromGeocodeAddress,
  readCachedUserAreaPayload,
  setCachedUserArea,
  USER_LOCATION_CACHE_KEY,
  USER_LOCATION_CACHE_TTL_MS,
} from "./resolveUserArea";

describe("pickAreaFromGeocodeAddress", () => {
  it("prefers suburb over neighbourhood, locality, and city", () => {
    expect(
      pickAreaFromGeocodeAddress({
        suburb: "Claremont",
        neighbourhood: "Harfield Village",
        locality: "Southern Suburbs",
        city: "Cape Town",
      }),
    ).toBe("Claremont");
  });

  it("skips electoral ward labels and uses suburb names", () => {
    expect(isUnusableGeocodeAreaName("Cape Town Ward 43")).toBe(true);

    expect(
      pickAreaFromGeocodeAddress({
        locality: "Cape Town Ward 43",
        suburb: "Claremont",
        city: "Cape Town",
      }),
    ).toBe("Claremont");

    expect(
      pickAreaFromGeocodeAddress({
        locality: "Cape Town Ward 43",
        neighbourhood: "Wynberg",
        city: "Cape Town",
      }),
    ).toBe("Wynberg");
  });

  it("returns null when only ward-level admin labels exist", () => {
    expect(
      pickAreaFromGeocodeAddress({
        locality: "Cape Town Ward 43",
        city: "Cape Town",
      }),
    ).toBeNull();
  });

  it("falls back through the priority chain", () => {
    expect(
      pickAreaFromGeocodeAddress({
        neighbourhood: "Sea Point",
        city: "Cape Town",
      }),
    ).toBe("Sea Point");

    expect(
      pickAreaFromGeocodeAddress({
        locality: "Wynberg",
        city: "Cape Town",
      }),
    ).toBe("Wynberg");
  });
});

describe("formatUserAreaDisplay", () => {
  it("formats known suburbs as Area, Cape Town", () => {
    expect(formatUserAreaDisplay("Claremont")).toBe("Claremont, Cape Town");
    expect(formatUserAreaDisplay("Wynberg")).toBe("Wynberg, Cape Town");
    expect(formatUserAreaDisplay("Sea Point")).toBe("Sea Point, Cape Town");
  });

  it("canonicalizes registry aliases", () => {
    expect(formatUserAreaDisplay("sea point")).toBe("Sea Point, Cape Town");
  });

  it("uses fallback for generic city-only results", () => {
    expect(formatUserAreaDisplay("Cape Town")).toBe("Cape Town, ZA");
  });

  it("uses fallback for ward admin labels", () => {
    expect(formatUserAreaDisplay("Cape Town Ward 43")).toBe("Cape Town, ZA");
  });
});

describe("parseNominatimReversePayload", () => {
  it("extracts suburb from nominatim address", () => {
    expect(
      parseNominatimReversePayload({
        address: { suburb: "Claremont", city: "Cape Town" },
      }),
    ).toEqual({
      areaName: "Claremont",
      displayLabel: "Claremont, Cape Town",
    });
  });

  it("returns null when no usable area fields exist", () => {
    expect(parseNominatimReversePayload({ address: { road: "Main Rd" } })).toBeNull();
  });
});

describe("buildResolvedUserArea", () => {
  it("never includes street-level fields in output", () => {
    const resolved = buildResolvedUserArea("Wynberg");
    expect(resolved.displayLabel).not.toMatch(/street|road|avenue/i);
    expect(resolved).toEqual({
      areaName: "Wynberg",
      displayLabel: "Wynberg, Cape Town",
    });
  });
});

describe("user area cache", () => {
  it("rejects cached ward labels", () => {
    expect(
      isCachedUserAreaValid({
        areaName: "Cape Town Ward 43",
        displayLabel: "Cape Town Ward 43, Cape Town",
        cachedAt: Date.now(),
      }),
    ).toBe(false);
  });

  it("validates TTL", () => {
    const fresh = {
      areaName: "Claremont",
      displayLabel: "Claremont, Cape Town",
      cachedAt: Date.now(),
    };
    expect(isCachedUserAreaValid(fresh)).toBe(true);

    const stale = {
      ...fresh,
      cachedAt: Date.now() - USER_LOCATION_CACHE_TTL_MS - 1,
    };
    expect(isCachedUserAreaValid(stale)).toBe(false);
  });

  it("reads and writes cache without coordinates", () => {
    const storage = new Map<string, string>();

    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });

    setCachedUserArea(buildResolvedUserArea("Sea Point"));
    const cached = getCachedUserArea();

    expect(cached?.displayLabel).toBe("Sea Point, Cape Town");
    const raw = storage.get(USER_LOCATION_CACHE_KEY);
    expect(raw).toBeTruthy();
    expect(raw).not.toMatch(/latitude|longitude|coords/i);

    const parsed = readCachedUserAreaPayload(raw!);
    expect(parsed?.areaName).toBe("Sea Point");
  });
});
