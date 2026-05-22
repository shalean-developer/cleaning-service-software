import { HOUSE_CLEANING_AREA_LABELS } from "./operationalAreaLabels";
import { LOCATION_REVIEW_OVERRIDES } from "./locationReviewOverrides";
import {
  SEO_LOCATION_NAMES,
  SEO_LOCATION_SEEDS,
  SEO_LOCATION_SLUG_LIST,
  type LocationSeoSlug,
} from "./seoLocationSeeds";

export type { LocationSeoSlug };
export { SEO_LOCATION_NAMES, SEO_LOCATION_SLUG_LIST, SEO_LOCATION_SEEDS };

export type ServiceAreaType =
  | "cape_town_suburb"
  | "cape_town_area"
  | "western_cape_town"
  | "garden_route"
  | "winelands"
  | "other";

export type LocationRegistryEntry = {
  name: string;
  slug: string;
  normalizedName: string;
  region: string;
  province: "Western Cape";
  country: "South Africa";
  cityGroup: string;
  isOperationalArea: boolean;
  isSeoLocation: boolean;
  isFeatured: boolean;
  seoSlug?: LocationSeoSlug;
  canonicalPath?: string;
  aliases: readonly string[];
  nearbyAreas: readonly string[];
  serviceAreaType: ServiceAreaType;
  requiresReview?: boolean;
  notes?: string;
};

export type BookingLocationOption = {
  value: string;
  label: string;
  slug: string;
  cityGroup: string;
  region: string;
  isSeoLocation: boolean;
};

export type CleanerAreaOption = BookingLocationOption & {
  isFeatured: boolean;
};

export type CleanerAreaOptionGroup = {
  region: string;
  options: CleanerAreaOption[];
};

const PROVINCE = "Western Cape" as const;
const COUNTRY = "South Africa" as const;

/** Display-name fixes before slugging. */
const NAME_CANONICAL: Record<string, string> = {
  tableview: "Table View",
  "table view": "Table View",
  "cape gate": "Cape Gate",
  oudshoorn: "Oudtshoorn",
  "d'urbanvale": "Durbanville",
  "d’urbanvale": "Durbanville",
  "cape town cbd": "Cape Town CBD",
  "brooklyn chestnut": "Brooklyn",
  "bo kaap": "De Waterkant",
  "bo-kaap": "De Waterkant",
};

const REGION_BY_KEYWORD: { pattern: RegExp; region: string; cityGroup: string; type: ServiceAreaType }[] = [
  {
    pattern:
      /^(george|knysna|mossel bay|plettenberg bay|plettenberg|sedgefield|wilderness|still bay|albertinia)$/i,
    region: "Garden Route",
    cityGroup: "Garden Route",
    type: "garden_route",
  },
  { pattern: /^(stellenbosch|paarl|wellington|franschhoek|tulbagh|robertson|montagu|worcester|ceres)$/i, region: "Winelands", cityGroup: "Winelands", type: "winelands" },
  { pattern: /^(hermanus|gansbaai|kleinmond|betty's bay|rooi els|pringle bay|saldanha|langebaan|vredenburg|malmesbury)$/i, region: "Overberg & West Coast", cityGroup: "Western Cape", type: "western_cape_town" },
  { pattern: /^(beaufort west|oudtshoorn|swellendam|caledon|grabouw|bredasdorp|barrydale|prince albert)$/i, region: "Western Cape Interior", cityGroup: "Western Cape", type: "western_cape_town" },
  {
    pattern:
      /^(atlantic seaboard|bantry bay|fresnaye|clifton|bakoven|llandudno|hout bay|sea point|green point|camps bay|mouille point|three anchor bay)/i,
    region: "Atlantic Seaboard",
    cityGroup: "Cape Town",
    type: "cape_town_suburb",
  },
  {
    pattern:
      /^(claremont|rondebosch|wynberg|constantia|kenilworth|newlands|tokai|bergvliet|plumstead|diep river|ottery|retreat|steenberg|meadowridge|southfield|bishopscourt|heathfield|wetton|youngsfield|protea valley|southern suburbs)/i,
    region: "Southern Suburbs",
    cityGroup: "Cape Town",
    type: "cape_town_suburb",
  },
  {
    pattern:
      /^(bellville|durbanville|brackenfell|kraaifontein|parow|goodwood|kuils river|blue downs|eerste river|northern suburbs|amandelrug|belhar|edgemead|elsies river|cape gate|bothasig|pinelands)/i,
    region: "Northern Suburbs",
    cityGroup: "Cape Town",
    type: "cape_town_suburb",
  },
  {
    pattern:
      /^(century city|milnerton|table view|blouberg|parklands|west beach|big bay|sunset beach|melkbos|atlantis|montague gardens|sunningdale)/i,
    region: "West Coast & Table Bay",
    cityGroup: "Cape Town",
    type: "cape_town_suburb",
  },
  {
    pattern:
      /^(observatory|woodstock|gardens|mowbray|rosebank|salt river|foreshore|tamboerskloof|vredehoek|oranjezicht|de waterkant|city bowl|cape town cbd|maitland|ndabeni|brooklyn|walmer estate)/i,
    region: "City Bowl & nearby",
    cityGroup: "Cape Town",
    type: "cape_town_suburb",
  },
  {
    pattern:
      /^(fish hoek|muizenberg|kommetjie|noordhoek|simon's town|scarborough|st james|marina da gama|somerset west|strand|gordon's bay|helderberg)/i,
    region: "False Bay & Helderberg",
    cityGroup: "Cape Town",
    type: "cape_town_suburb",
  },
  {
    pattern:
      /^(athlone|lansdowne|crawford|mitchells plain|khayelitsha|nyanga|langa|philippi|delft|crossroads|grassy park|pelican park|capri|macassar|rylands|zeekoevlei|joe slovo park|cape flats)/i,
    region: "Cape Flats & surrounds",
    cityGroup: "Cape Town",
    type: "cape_town_suburb",
  },
];

/** Broad labels kept operational-only; classified in locationReviewOverrides.ts */
const BROAD_REGION_LABELS = new Set([
  "northern suburbs",
  "southern suburbs",
  "cape flats",
  "helderberg",
]);

function stripHouseCleaningPrefix(label: string): string {
  return label.replace(/^house\s+cleaning\s+/i, "").trim();
}

export function normalizeLocationName(raw: string): string {
  const stripped = stripHouseCleaningPrefix(raw).trim();
  if (!stripped) return "";
  const key = stripped.toLowerCase();
  if (NAME_CANONICAL[key]) return NAME_CANONICAL[key];
  return stripped
    .split(/\s+/)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "cbd") return "CBD";
      if (word.includes("'")) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\bCbd\b/g, "CBD");
}

export function slugFromLocationName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizedNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function inferGeo(name: string): Pick<
  LocationRegistryEntry,
  "region" | "cityGroup" | "serviceAreaType" | "requiresReview"
> {
  const isBroad = BROAD_REGION_LABELS.has(normalizedNameKey(name));
  for (const rule of REGION_BY_KEYWORD) {
    if (rule.pattern.test(name)) {
      const serviceAreaType = isBroad ? ("cape_town_area" as const) : rule.type;
      return {
        region: rule.region,
        cityGroup: rule.cityGroup,
        serviceAreaType,
        requiresReview: undefined,
      };
    }
  }
  if (/cape town/i.test(name)) {
    return {
      region: "Cape Town",
      cityGroup: "Cape Town",
      serviceAreaType: "cape_town_area",
      requiresReview: undefined,
    };
  }
  return {
    region: "Western Cape",
    cityGroup: "Western Cape",
    serviceAreaType: "western_cape_town",
    requiresReview: true,
  };
}

function applyReviewOverride(entry: LocationRegistryEntry): LocationRegistryEntry {
  const override = LOCATION_REVIEW_OVERRIDES[entry.slug];
  if (!override) return entry;
  return {
    ...entry,
    region: override.region,
    cityGroup: override.cityGroup,
    serviceAreaType: override.serviceAreaType,
    aliases: override.aliases ? [...override.aliases] : entry.aliases,
    nearbyAreas: override.nearbyAreas ? [...override.nearbyAreas] : entry.nearbyAreas,
    requiresReview: false,
    notes: override.notes,
  };
}

function buildSeoEntries(): LocationRegistryEntry[] {
  return SEO_LOCATION_SEEDS.map((seed) => ({
    name: seed.name,
    slug: seed.slug,
    normalizedName: normalizedNameKey(seed.name),
    region: seed.region,
    province: PROVINCE,
    country: COUNTRY,
    cityGroup: "Cape Town",
    isOperationalArea: true,
    isSeoLocation: true,
    isFeatured: true,
    seoSlug: seed.seoSlug,
    canonicalPath: seed.canonicalPath,
    aliases: [...seed.aliases],
    nearbyAreas: [...seed.nearbyAreas],
    serviceAreaType: "cape_town_suburb" as const,
  }));
}

function buildOperationalFromLabels(seoBySlug: Map<string, LocationRegistryEntry>): LocationRegistryEntry[] {
  const byNormalized = new Map<string, LocationRegistryEntry>();
  for (const entry of seoBySlug.values()) {
    byNormalized.set(entry.normalizedName, entry);
  }

  for (const label of HOUSE_CLEANING_AREA_LABELS) {
    const name = normalizeLocationName(label);
    if (!name) continue;
    const normKey = normalizedNameKey(name);
    if (byNormalized.has(normKey)) continue;

    const slug = slugFromLocationName(name);
    if (seoBySlug.has(slug)) continue;

    const geo = inferGeo(name);
    let entry: LocationRegistryEntry = {
      name,
      slug,
      normalizedName: normKey,
      region: geo.region,
      province: PROVINCE,
      country: COUNTRY,
      cityGroup: geo.cityGroup,
      isOperationalArea: true,
      isSeoLocation: false,
      isFeatured: false,
      aliases: [],
      nearbyAreas: [],
      serviceAreaType: geo.serviceAreaType,
      requiresReview: geo.requiresReview,
    };
    entry = applyReviewOverride(entry);
    byNormalized.set(normKey, entry);
    seoBySlug.set(slug, entry);
  }

  return [...byNormalized.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildRegistry(): LocationRegistryEntry[] {
  const seoEntries = buildSeoEntries();
  const bySlug = new Map<string, LocationRegistryEntry>();
  for (const e of seoEntries) {
    bySlug.set(e.slug, e);
  }
  return buildOperationalFromLabels(bySlug);
}

export const LOCATION_REGISTRY: readonly LocationRegistryEntry[] = buildRegistry();

const BY_SLUG = new Map(LOCATION_REGISTRY.map((e) => [e.slug, e]));
const BY_NORMALIZED = new Map(LOCATION_REGISTRY.map((e) => [e.normalizedName, e]));
const BY_ALIAS = new Map<string, LocationRegistryEntry>();

for (const entry of LOCATION_REGISTRY) {
  for (const alias of entry.aliases) {
    const key = normalizedNameKey(alias);
    if (!BY_ALIAS.has(key)) BY_ALIAS.set(key, entry);
  }
  const nameKey = normalizedNameKey(entry.name);
  if (!BY_ALIAS.has(nameKey)) BY_ALIAS.set(nameKey, entry);
}

export function getSeoLocations(): LocationRegistryEntry[] {
  return LOCATION_REGISTRY.filter((e) => e.isSeoLocation);
}

export function getOperationalServiceAreas(): LocationRegistryEntry[] {
  return LOCATION_REGISTRY.filter((e) => e.isOperationalArea);
}

export function getFeaturedOperationalAreas(): LocationRegistryEntry[] {
  return LOCATION_REGISTRY.filter((e) => e.isOperationalArea && e.isFeatured);
}

export function findLocationBySlug(slug: string): LocationRegistryEntry | undefined {
  return BY_SLUG.get(slugFromLocationName(slug));
}

export function findLocationByNameOrAlias(input: string): LocationRegistryEntry | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const direct = BY_SLUG.get(slugFromLocationName(trimmed));
  if (direct) return direct;
  const normalized = normalizedNameKey(normalizeLocationName(trimmed));
  return BY_NORMALIZED.get(normalized) ?? BY_ALIAS.get(normalized);
}

/** Resolve booking/dispatch/cleaner area slug; falls back to generic slugify. */
export function resolveAreaSlug(input: string): string {
  const match = findLocationByNameOrAlias(input);
  if (match) return match.slug;
  return slugFromLocationName(normalizeLocationName(input) || input);
}

export function locationToBookingOption(entry: LocationRegistryEntry): BookingLocationOption {
  return {
    value: entry.name,
    label: entry.name,
    slug: entry.slug,
    cityGroup: entry.cityGroup,
    region: entry.region,
    isSeoLocation: entry.isSeoLocation,
  };
}

export function locationToCleanerAreaOption(entry: LocationRegistryEntry): CleanerAreaOption {
  return {
    ...locationToBookingOption(entry),
    isFeatured: entry.isFeatured,
  };
}

export function getBookingLocationOptions(): BookingLocationOption[] {
  return getOperationalServiceAreas().map(locationToBookingOption);
}

/** Canonical region order for operational UX (booking, admin, apply, filters). */
export const OPERATIONAL_REGION_ORDER: readonly string[] = [
  "Atlantic Seaboard",
  "Southern Suburbs",
  "Northern Suburbs",
  "City Bowl & nearby",
  "West Coast & Table Bay",
  "Cape Flats & surrounds",
  "False Bay & Helderberg",
  "Winelands",
  "Garden Route",
  "Overberg & West Coast",
  "Western Cape Interior",
  "Cape Town",
  "Western Cape",
] as const;

function regionSortIndex(region: string): number {
  const idx = OPERATIONAL_REGION_ORDER.indexOf(region);
  return idx === -1 ? OPERATIONAL_REGION_ORDER.length : idx;
}

export function sortCleanerAreaOptionGroups(
  groups: CleanerAreaOptionGroup[],
): CleanerAreaOptionGroup[] {
  return [...groups].sort((a, b) => regionSortIndex(a.region) - regionSortIndex(b.region));
}

export function getCleanerAreaOptionGroups(): CleanerAreaOptionGroup[] {
  const groups = new Map<string, CleanerAreaOption[]>();
  for (const entry of getOperationalServiceAreas()) {
    const list = groups.get(entry.region) ?? [];
    list.push(locationToCleanerAreaOption(entry));
    groups.set(entry.region, list);
  }
  const built = [...groups.entries()].map(([region, options]) => ({
    region,
    options: options.sort((a, b) => a.label.localeCompare(b.label)),
  }));
  return sortCleanerAreaOptionGroups(built);
}

/** Twelve featured SEO suburbs — popular defaults for booking and apply. */
export function getPopularOperationalAreas(): CleanerAreaOption[] {
  return getFeaturedOperationalAreas().map(locationToCleanerAreaOption);
}

export function displayLabelForAreaSlug(slug: string): string {
  return findLocationBySlug(slug)?.name ?? slug;
}

export function getRegistryAuditSummary(): {
  total: number;
  operational: number;
  seo: number;
  requiresReview: number;
  featured: number;
  bookingOptionCount: number;
  cleanerAreaOptionCount: number;
} {
  const operational = getOperationalServiceAreas();
  return {
    total: LOCATION_REGISTRY.length,
    operational: operational.length,
    seo: getSeoLocations().length,
    requiresReview: LOCATION_REGISTRY.filter((e) => e.requiresReview).length,
    featured: LOCATION_REGISTRY.filter((e) => e.isFeatured).length,
    bookingOptionCount: operational.length,
    cleanerAreaOptionCount: operational.length,
  };
}

export function assertRegistryInvariants(): void {
  const slugs = new Set<string>();
  const names = new Set<string>();
  for (const entry of LOCATION_REGISTRY) {
    if (slugs.has(entry.slug)) {
      throw new Error(`Duplicate registry slug: ${entry.slug}`);
    }
    slugs.add(entry.slug);
    if (names.has(entry.normalizedName)) {
      throw new Error(`Duplicate normalized name: ${entry.name}`);
    }
    names.add(entry.normalizedName);
    if (entry.isSeoLocation) {
      if (!entry.seoSlug?.endsWith("-cape-town")) {
        throw new Error(`SEO location missing canonical seoSlug: ${entry.name}`);
      }
      if (!entry.canonicalPath?.startsWith("/locations/")) {
        throw new Error(`SEO location missing canonicalPath: ${entry.name}`);
      }
    } else if (entry.seoSlug || entry.canonicalPath) {
      throw new Error(`Operational-only location must not have SEO paths: ${entry.name}`);
    }
  }

  const seo = getSeoLocations();
  if (seo.length !== 12) {
    throw new Error(`Expected 12 SEO locations, got ${seo.length}`);
  }
  for (const expected of SEO_LOCATION_NAMES) {
    if (!seo.some((e) => e.name === expected)) {
      throw new Error(`Missing SEO location: ${expected}`);
    }
  }
}

assertRegistryInvariants();
