import { LOCATION_SEO_SLUG_LIST } from "../marketing/locationSlugList";

/** URL segment after `/locations/` (e.g. sea-point-cape-town). */
export type LocationSeoSlug = `${string}-cape-town`;

/** Canonical 12 SEO suburb pages — order matches `locationSlugList.ts` for next.config. */
export const SEO_LOCATION_SEEDS = [
  {
    name: "Sea Point",
    slug: "sea-point",
    region: "Atlantic Seaboard",
    nearbyAreas: ["green-point", "camps-bay", "claremont"] as const,
    seoSlug: "sea-point-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/sea-point-cape-town",
    aliases: ["Sea Point Cape Town"],
  },
  {
    name: "Claremont",
    slug: "claremont",
    region: "Southern Suburbs",
    nearbyAreas: ["rondebosch", "wynberg", "observatory", "sea-point"] as const,
    seoSlug: "claremont-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/claremont-cape-town",
    aliases: ["Claremont Cape Town"],
  },
  {
    name: "Camps Bay",
    slug: "camps-bay",
    region: "Atlantic Seaboard",
    nearbyAreas: ["sea-point", "green-point", "claremont"] as const,
    seoSlug: "camps-bay-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/camps-bay-cape-town",
    aliases: ["Camps Bay Cape Town"],
  },
  {
    name: "Century City",
    slug: "century-city",
    region: "West Coast & Table Bay",
    nearbyAreas: ["milnerton", "bellville", "table-view"] as const,
    seoSlug: "century-city-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/century-city-cape-town",
    aliases: ["Century City Cape Town"],
  },
  {
    name: "Bellville",
    slug: "bellville",
    region: "Northern Suburbs",
    nearbyAreas: ["durbanville", "century-city", "table-view"] as const,
    seoSlug: "bellville-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/bellville-cape-town",
    aliases: ["Bellville Cape Town"],
  },
  {
    name: "Durbanville",
    slug: "durbanville",
    region: "Northern Suburbs",
    nearbyAreas: ["bellville", "table-view", "century-city"] as const,
    seoSlug: "durbanville-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/durbanville-cape-town",
    aliases: ["Durbanville Cape Town", "D'Urbanvale"],
  },
  {
    name: "Table View",
    slug: "table-view",
    region: "West Coast & Table Bay",
    nearbyAreas: ["milnerton", "bellville", "durbanville"] as const,
    seoSlug: "table-view-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/table-view-cape-town",
    aliases: ["Table View Cape Town", "Tableview"],
  },
  {
    name: "Observatory",
    slug: "observatory",
    region: "City Bowl & nearby",
    nearbyAreas: ["rondebosch", "claremont", "wynberg"] as const,
    seoSlug: "observatory-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/observatory-cape-town",
    aliases: ["Observatory Cape Town"],
  },
  {
    name: "Rondebosch",
    slug: "rondebosch",
    region: "Southern Suburbs",
    nearbyAreas: ["claremont", "observatory", "wynberg"] as const,
    seoSlug: "rondebosch-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/rondebosch-cape-town",
    aliases: ["Rondebosch Cape Town"],
  },
  {
    name: "Wynberg",
    slug: "wynberg",
    region: "Southern Suburbs",
    nearbyAreas: ["claremont", "rondebosch", "observatory"] as const,
    seoSlug: "wynberg-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/wynberg-cape-town",
    aliases: ["Wynberg Cape Town"],
  },
  {
    name: "Green Point",
    slug: "green-point",
    region: "Atlantic Seaboard",
    nearbyAreas: ["sea-point", "camps-bay", "claremont"] as const,
    seoSlug: "green-point-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/green-point-cape-town",
    aliases: ["Green Point Cape Town"],
  },
  {
    name: "Milnerton",
    slug: "milnerton",
    region: "West Coast & Table Bay",
    nearbyAreas: ["table-view", "century-city", "green-point"] as const,
    seoSlug: "milnerton-cape-town" as LocationSeoSlug,
    canonicalPath: "/locations/milnerton-cape-town",
    aliases: ["Milnerton Cape Town"],
  },
] as const;

/** Display order for marketing (matches legacy CAPE_TOWN_AREAS). */
export const SEO_LOCATION_NAMES = [
  "Sea Point",
  "Claremont",
  "Camps Bay",
  "Century City",
  "Bellville",
  "Durbanville",
  "Table View",
  "Observatory",
  "Rondebosch",
  "Wynberg",
  "Green Point",
  "Milnerton",
] as const;

const seedNames = new Set(SEO_LOCATION_SEEDS.map((s) => s.name));
for (const name of SEO_LOCATION_NAMES) {
  if (!seedNames.has(name)) {
    throw new Error(`SEO_LOCATION_NAMES missing seed for ${name}`);
  }
}

const _derivedSlugs = SEO_LOCATION_SEEDS.map((s) => s.seoSlug);
if (
  _derivedSlugs.length !== LOCATION_SEO_SLUG_LIST.length ||
  !_derivedSlugs.every((slug, i) => slug === LOCATION_SEO_SLUG_LIST[i])
) {
  throw new Error(
    "seoLocationSeeds SEO slugs are out of sync with marketing/locationSlugList.ts",
  );
}

export const SEO_LOCATION_SLUG_LIST = LOCATION_SEO_SLUG_LIST;
