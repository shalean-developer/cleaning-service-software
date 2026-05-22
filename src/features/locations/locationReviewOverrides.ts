import type { ServiceAreaType } from "./locationRegistry";

/** Classification from Location Registry Review Phase (operational metadata only). */
export type LocationReviewDecision =
  | "valid_cape_town_suburb"
  | "valid_western_cape_town"
  | "broad_region_label"
  | "duplicate_or_alias"
  | "typo_or_needs_rename"
  | "unsupported_or_remove";

export type LocationReviewOverride = {
  decision: LocationReviewDecision;
  region: string;
  cityGroup: string;
  serviceAreaType: ServiceAreaType;
  aliases?: readonly string[];
  nearbyAreas?: readonly string[];
  requiresReview: false;
  notes: string;
  /** Documented for promotion planning — does not enable SEO. */
  futureSeoCandidate?: boolean;
};

/**
 * Reviewed overrides for areas that were flagged `requiresReview` during import.
 * Keys are operational slugs (`slugFromLocationName`).
 */
export const LOCATION_REVIEW_OVERRIDES: Record<string, LocationReviewOverride> = {
  atlantis: {
    decision: "valid_cape_town_suburb",
    region: "West Coast & Table Bay",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["melkbosstrand", "bloubergstrand"],
    requiresReview: false,
    notes: "West Coast township — operational suburb, not an SEO page.",
  },
  bishopscourt: {
    decision: "valid_cape_town_suburb",
    region: "Southern Suburbs",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["claremont", "kenilworth", "rondebosch"],
    requiresReview: false,
    notes: "Southern Suburbs estate suburb — operational only.",
    futureSeoCandidate: true,
  },
  bothasig: {
    decision: "valid_cape_town_suburb",
    region: "Northern Suburbs",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["montague-gardens", "milnerton", "table-view"],
    requiresReview: false,
    notes: "Northern Suburbs industrial/residential — operational only.",
  },
  brooklyn: {
    decision: "valid_cape_town_suburb",
    region: "City Bowl & nearby",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    aliases: ["Brooklyn Chestnut"],
    nearbyAreas: ["maitland", "ndabeni", "montague-gardens"],
    requiresReview: false,
    notes: "Cape Town Brooklyn (not NY) — operational only.",
  },
  "cape-flats": {
    decision: "broad_region_label",
    region: "Cape Flats & surrounds",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_area",
    requiresReview: false,
    notes: "Broad operational label for Cape Flats bookings — not a single suburb or SEO target.",
  },
  "cape-gate": {
    decision: "valid_cape_town_suburb",
    region: "Northern Suburbs",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["century-city", "kuils-river", "bellville"],
    requiresReview: false,
    notes: "Retail/business node near Kuils River — operational only.",
  },
  edgemead: {
    decision: "valid_cape_town_suburb",
    region: "Northern Suburbs",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["bellville", "parow", "bothasig"],
    requiresReview: false,
    notes: "Northern Suburbs residential — operational only.",
  },
  "elsies-river": {
    decision: "valid_cape_town_suburb",
    region: "Northern Suburbs",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["belhar", "parow", "goodwood"],
    requiresReview: false,
    notes: "Northern Suburbs / Cape Flats edge — operational only.",
  },
  heathfield: {
    decision: "valid_cape_town_suburb",
    region: "Southern Suburbs",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["wynberg", "plumstead", "diep-river"],
    requiresReview: false,
    notes: "Southern Suburbs — operational only.",
  },
  helderberg: {
    decision: "broad_region_label",
    region: "False Bay & Helderberg",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_area",
    nearbyAreas: ["somerset-west", "strand", "gordon-s-bay"],
    requiresReview: false,
    notes: "Broad Helderberg basin label — use Somerset West/Strand for precision; operational only.",
  },
  "joe-slovo-park": {
    decision: "valid_cape_town_suburb",
    region: "Cape Flats & surrounds",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["mitchells-plain", "langa", "nyanga"],
    requiresReview: false,
    notes: "Cape Flats township — operational only.",
  },
  maitland: {
    decision: "valid_cape_town_suburb",
    region: "City Bowl & nearby",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["ndabeni", "brooklyn", "pinelands"],
    requiresReview: false,
    notes: "City Bowl fringe — operational only.",
  },
  "marina-da-gama": {
    decision: "valid_cape_town_suburb",
    region: "False Bay & Helderberg",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    aliases: ["Marina da Gama"],
    nearbyAreas: ["muizenberg", "st-james", "fish-hoek"],
    requiresReview: false,
    notes: "False Bay coastal suburb — operational only.",
  },
  "montague-gardens": {
    decision: "valid_cape_town_suburb",
    region: "West Coast & Table Bay",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["bothasig", "milnerton", "brooklyn"],
    requiresReview: false,
    notes: "West Coast business precinct — operational only.",
  },
  "mouille-point": {
    decision: "valid_cape_town_suburb",
    region: "Atlantic Seaboard",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["green-point", "sea-point", "three-anchor-bay"],
    requiresReview: false,
    notes: "Atlantic Seaboard — operational only.",
    futureSeoCandidate: true,
  },
  ndabeni: {
    decision: "valid_cape_town_suburb",
    region: "City Bowl & nearby",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["pinelands", "maitland", "observatory"],
    requiresReview: false,
    notes: "City Bowl fringe industrial/residential — operational only.",
  },
  "northern-suburbs": {
    decision: "broad_region_label",
    region: "Northern Suburbs",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_area",
    requiresReview: false,
    notes: "Broad operational label — not an SEO suburb. Prefer Bellville, Durbanville, etc.",
  },
  pinelands: {
    decision: "valid_cape_town_suburb",
    region: "Southern Suburbs",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["ndabeni", "century-city", "maitland"],
    requiresReview: false,
    notes: "Pinelands suburb — operational only.",
    futureSeoCandidate: true,
  },
  "plettenberg-bay": {
    decision: "valid_western_cape_town",
    region: "Garden Route",
    cityGroup: "Garden Route",
    serviceAreaType: "garden_route",
    nearbyAreas: ["knysna", "mossel-bay", "sedgefield"],
    requiresReview: false,
    notes: "Garden Route town — operational only, outside Cape Town SEO cluster.",
  },
  "protea-valley": {
    decision: "valid_cape_town_suburb",
    region: "Cape Flats & surrounds",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["athlone", "lansdowne", "rylands"],
    requiresReview: false,
    notes: "Cape Flats residential — operational only.",
  },
  rylands: {
    decision: "valid_cape_town_suburb",
    region: "Cape Flats & surrounds",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["athlone", "lansdowne", "protea-valley"],
    requiresReview: false,
    notes: "Cape Flats residential — operational only.",
  },
  "southern-suburbs": {
    decision: "broad_region_label",
    region: "Southern Suburbs",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_area",
    requiresReview: false,
    notes: "Broad operational label — not an SEO suburb. Prefer Claremont, Wynberg, etc.",
  },
  sunningdale: {
    decision: "valid_cape_town_suburb",
    region: "West Coast & Table Bay",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["bloubergstrand", "parklands", "table-view"],
    requiresReview: false,
    notes: "Blouberg/Sunningdale residential — operational only.",
  },
  "three-anchor-bay": {
    decision: "valid_cape_town_suburb",
    region: "Atlantic Seaboard",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["sea-point", "green-point", "mouille-point"],
    requiresReview: false,
    notes: "Atlantic Seaboard — operational only.",
    futureSeoCandidate: true,
  },
  "walmer-estate": {
    decision: "valid_cape_town_suburb",
    region: "City Bowl & nearby",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["woodstock", "observatory", "zonnebloem"],
    requiresReview: false,
    notes: "City Bowl fringe — operational only.",
  },
  wetton: {
    decision: "valid_cape_town_suburb",
    region: "Southern Suburbs",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["wynberg", "plumstead", "ottery"],
    requiresReview: false,
    notes: "Southern Suburbs — operational only.",
  },
  youngsfield: {
    decision: "valid_cape_town_suburb",
    region: "Southern Suburbs",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["wynberg", "heathfield", "retreat"],
    requiresReview: false,
    notes: "Southern Suburbs — operational only.",
  },
  zeekoevlei: {
    decision: "valid_cape_town_suburb",
    region: "Cape Flats & surrounds",
    cityGroup: "Cape Town",
    serviceAreaType: "cape_town_suburb",
    nearbyAreas: ["pelican-park", "grassy-park", "philippi"],
    requiresReview: false,
    notes: "Cape Flats / wetland fringe suburb — operational only.",
  },
};

/** Slugs reviewed in Phase 3.5 review (must stay requiresReview-cleared). */
export const REVIEWED_LOCATION_SLUGS = Object.keys(LOCATION_REVIEW_OVERRIDES);
