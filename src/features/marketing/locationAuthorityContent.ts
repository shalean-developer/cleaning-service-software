import {
  CAPE_TOWN_AREAS,
  REVIEWS,
  SERVICE_SEO_PATHS,
  areaLocationPath,
} from "./constants";
import type { ServiceSlug } from "@/features/pricing/server/types";
import {
  locationSlugFromArea,
  LOCATION_SEO_SLUGS,
  PRICING_PAGE_PATH,
  type LocationSeoSlug,
} from "./marketing-routes";

export type LocationRegionId =
  | "atlantic-seaboard"
  | "southern-suburbs"
  | "northern-suburbs"
  | "city-bowl"
  | "west-coast";

export type LocationPopularService = {
  slug: ServiceSlug;
  href: string;
  linkLabel: string;
  blurb: string;
};

export type LocationFaqItem = {
  question: string;
  answer: string;
};

export type LocationAuthorityContent = {
  regionId: LocationRegionId;
  localOverview: string;
  popularServices: readonly LocationPopularService[];
  faqs: readonly LocationFaqItem[];
};

export const LOCATION_TRUST_POINTS = [
  {
    title: "Vetted cleaners",
    description: "Background-checked professionals matched to your home, rental, or office.",
  },
  {
    title: "Secure online booking",
    description: "Book, pay, and manage visits from your account with encrypted checkout.",
  },
  {
    title: "Local Cape Town support",
    description: "Mon–Sat help for scheduling, changes, and service questions.",
  },
  {
    title: "Transparent pricing",
    description: "See starting rates and your quote before you confirm. no hidden fees.",
  },
] as const;

export const LOCATION_PROOF_HEADLINE =
  "Trusted by Cape Town homes, Airbnb hosts, and workplaces." as const;

export type LocationRegion = {
  id: LocationRegionId;
  title: string;
  intro: string;
  areas: readonly (typeof CAPE_TOWN_AREAS)[number][];
};

export const LOCATION_REGIONS: readonly LocationRegion[] = [
  {
    id: "atlantic-seaboard",
    title: "Atlantic Seaboard",
    intro:
      "Coastal apartments, holiday rentals, and family homes from Sea Point through Camps Bay. popular for Airbnb turnovers and same-day refreshes.",
    areas: ["Sea Point", "Green Point", "Camps Bay"],
  },
  {
    id: "city-bowl",
    title: "City Bowl & nearby",
    intro:
      "Dense rentals, student accommodation, and mixed housing near the CBD. ideal for flexible recurring cleans and tenant handovers.",
    areas: ["Observatory"],
  },
  {
    id: "southern-suburbs",
    title: "Southern Suburbs",
    intro:
      "Family suburbs, student rentals, and Cavendish-area homes. strong demand for recurring home care, deep cleans, and move-in/out handovers.",
    areas: ["Claremont", "Rondebosch", "Wynberg"],
  },
  {
    id: "northern-suburbs",
    title: "Northern Suburbs",
    intro:
      "Established neighbourhoods and wine-route estates north of the CBD. reliable scheduling for homes, estates, and small offices.",
    areas: ["Bellville", "Durbanville"],
  },
  {
    id: "west-coast",
    title: "West Coast & Table Bay",
    intro:
      "Coastal and canal-side communities from Table View to Milnerton and Century City. sand-aware home care, offices, and mixed-use buildings.",
    areas: ["Table View", "Milnerton", "Century City"],
  },
] as const;

function serviceInArea(slug: ServiceSlug, area: string, blurb: string): LocationPopularService {
  const labelBySlug: Record<ServiceSlug, string> = {
    "regular-cleaning": `Regular cleaning in ${area}`,
    "deep-cleaning": `Deep cleaning in ${area}`,
    "moving-cleaning": `Move-in/out cleaning in ${area}`,
    "airbnb-cleaning": `Airbnb cleaning in ${area}`,
    "office-cleaning": `Office cleaning in ${area}`,
    "carpet-cleaning": `Carpet cleaning in ${area}`,
  };
  return {
    slug,
    href: SERVICE_SEO_PATHS[slug],
    linkLabel: labelBySlug[slug],
    blurb,
  };
}

function faq(
  area: string,
  variant: "homes" | "services" | "cost" | "recurring" | "equipment",
): LocationFaqItem {
  switch (variant) {
    case "homes":
      return {
        question: `Do you clean homes in ${area}?`,
        answer: `Yes. Shalean serves ${area} and nearby Cape Town suburbs with vetted, insured cleaners. Book online and choose your service type, home size, and preferred date.`,
      };
    case "services":
      return {
        question: `Which cleaning services are available in ${area}?`,
        answer: `Homes and rentals in ${area} commonly book regular cleaning, deep cleaning, Airbnb turnovers, move-in/out handovers, office cleaning, and carpet care. Service scope and pricing depend on your property. see our Cape Town cleaning prices for starting rates.`,
      };
    case "cost":
      return {
        question: `How much does cleaning cost in ${area}?`,
        answer: `Cleaning prices in ${area} depend on service type, bedrooms, bathrooms, add-ons, and frequency. not a flat suburb fee. Use our online quote when booking or view transparent starting rates on the Cape Town pricing page.`,
      };
    case "recurring":
      return {
        question: `Can I book recurring cleaning in ${area}?`,
        answer: `Yes. Weekly, bi-weekly, and monthly regular cleaning is available in ${area} where cleaners have capacity. Each visit is booked and paid individually. no subscription lock-in.`,
      };
    case "equipment":
      return {
        question: `Do cleaners bring equipment in ${area}?`,
        answer: `Shalean cleaners typically arrive with professional-grade products and equipment for ${area} bookings. For regular cleaning you can note if you prefer to use your own supplies.`,
      };
  }
}

const AUTHORITY_BY_AREA: Record<
  (typeof CAPE_TOWN_AREAS)[number],
  LocationAuthorityContent
> = {
  "Sea Point": {
    regionId: "atlantic-seaboard",
    localOverview:
      "Sea Point combines high-density apartments, family flats, and short-term rentals along the Atlantic Seaboard. Hosts often need fast turnovers between guests, while residents want reliable weekday cleans that fit parking and building access rules.",
    popularServices: [
      serviceInArea("airbnb-cleaning", "Sea Point", "Guest-ready turnovers between check-out and check-in."),
      serviceInArea("regular-cleaning", "Sea Point", "Ongoing kitchen, bathroom, and living-area maintenance."),
      serviceInArea("deep-cleaning", "Sea Point", "Seasonal refreshes and pre-event intensive cleans."),
      serviceInArea("moving-cleaning", "Sea Point", "Tenant handovers for apartments near the promenade."),
    ],
    faqs: [faq("Sea Point", "homes"), faq("Sea Point", "services"), faq("Sea Point", "cost")],
  },
  "Green Point": {
    regionId: "atlantic-seaboard",
    localOverview:
      "Green Point sits close to the CBD with a mix of Airbnb listings, young professional apartments, and older residential blocks. Cleaning demand peaks around guest changeovers and mid-week maintenance for busy households.",
    popularServices: [
      serviceInArea("airbnb-cleaning", "Green Point", "Short-stay turnovers with checklist-ready finishing."),
      serviceInArea("regular-cleaning", "Green Point", "Flexible one-off or recurring apartment care."),
      serviceInArea("deep-cleaning", "Green Point", "Intensive cleans before hosting or after renovations."),
      serviceInArea("office-cleaning", "Green Point", "Small offices and studio workspaces near the stadium precinct."),
    ],
    faqs: [faq("Green Point", "homes"), faq("Green Point", "recurring"), faq("Green Point", "equipment")],
  },
  "Camps Bay": {
    regionId: "atlantic-seaboard",
    localOverview:
      "Camps Bay properties range from luxury villas to holiday apartments with high guest expectations. Deep cleans before events and meticulous Airbnb turnovers are common, alongside regular upkeep for full-time residents.",
    popularServices: [
      serviceInArea("airbnb-cleaning", "Camps Bay", "Premium turnovers for holiday rentals and villas."),
      serviceInArea("deep-cleaning", "Camps Bay", "Top-to-bottom refreshes for entertainment and handovers."),
      serviceInArea("regular-cleaning", "Camps Bay", "Maintaining kitchens, bathrooms, and entertainment areas."),
      serviceInArea("carpet-cleaning", "Camps Bay", "High-traffic lounge and stair carpet care."),
    ],
    faqs: [faq("Camps Bay", "homes"), faq("Camps Bay", "cost"), faq("Camps Bay", "equipment")],
  },
  Observatory: {
    regionId: "city-bowl",
    localOverview:
      "Observatory has a blend of student rentals, shared houses, and family homes near UCT and the City Bowl. Affordable regular cleaning and end-of-lease move-out cleans are especially common requests.",
    popularServices: [
      serviceInArea("regular-cleaning", "Observatory", "Budget-friendly upkeep for rentals and family homes."),
      serviceInArea("moving-cleaning", "Observatory", "End-of-lease and new-tenant handover cleans."),
      serviceInArea("deep-cleaning", "Observatory", "Intensive kitchen and bathroom resets between tenants."),
      serviceInArea("airbnb-cleaning", "Observatory", "Smaller short-term units near main road corridors."),
    ],
    faqs: [faq("Observatory", "homes"), faq("Observatory", "services"), faq("Observatory", "recurring")],
  },
  Claremont: {
    regionId: "southern-suburbs",
    localOverview:
      "Claremont families, Cavendish shoppers, and student rentals drive steady demand for recurring home cleaning and periodic deep refreshes. Move-in/out cleans are popular around lease changeovers near main transport corridors.",
    popularServices: [
      serviceInArea("regular-cleaning", "Claremont", "Recurring care for Southern Suburbs households."),
      serviceInArea("deep-cleaning", "Claremont", "Spring cleans and pre-guest intensive work."),
      serviceInArea("moving-cleaning", "Claremont", "Handovers for flats and houses near Cavendish."),
      serviceInArea("airbnb-cleaning", "Claremont", "Guest turnovers for smaller rental units."),
    ],
    faqs: [faq("Claremont", "homes"), faq("Claremont", "recurring"), faq("Claremont", "cost")],
  },
  Rondebosch: {
    regionId: "southern-suburbs",
    localOverview:
      "Rondebosch hosts, homeowners, and shared rentals often need study-friendly regular cleans that respect quiet hours, plus Airbnb turnovers near UCT. Deep kitchen and bathroom work is common before inspections.",
    popularServices: [
      serviceInArea("airbnb-cleaning", "Rondebosch", "Turnovers for student-adjacent short stays."),
      serviceInArea("regular-cleaning", "Rondebosch", "Weekly or bi-weekly home maintenance."),
      serviceInArea("deep-cleaning", "Rondebosch", "Detailed resets for kitchens and bathrooms."),
      serviceInArea("moving-cleaning", "Rondebosch", "Lease-end cleaning for rental flats."),
    ],
    faqs: [faq("Rondebosch", "homes"), faq("Rondebosch", "services"), faq("Rondebosch", "equipment")],
  },
  Wynberg: {
    regionId: "southern-suburbs",
    localOverview:
      "Wynberg and surrounds mix established family homes with older cottages and rental stock. Customers often book flexible one-off deep cleans or set up recurring schedules that fit school and commute routines.",
    popularServices: [
      serviceInArea("regular-cleaning", "Wynberg", "Flexible recurring or ad-hoc home cleaning."),
      serviceInArea("deep-cleaning", "Wynberg", "Seasonal top-to-bottom property refreshes."),
      serviceInArea("moving-cleaning", "Wynberg", "Move-in readiness and tenant exit cleans."),
      serviceInArea("carpet-cleaning", "Wynberg", "Lounge and bedroom carpet spot treatment."),
    ],
    faqs: [faq("Wynberg", "homes"), faq("Wynberg", "cost"), faq("Wynberg", "recurring")],
  },
  "Century City": {
    regionId: "west-coast",
    localOverview:
      "Century City combines canal-side townhouses, apartment complexes, and office parks near Canal Walk. Regular apartment cleaning, office contracts, and carpet refreshes are typical for residents and businesses in the precinct.",
    popularServices: [
      serviceInArea("office-cleaning", "Century City", "Workspace and studio cleaning near business parks."),
      serviceInArea("regular-cleaning", "Century City", "Townhouse and apartment maintenance."),
      serviceInArea("deep-cleaning", "Century City", "Intensive cleans for mixed-use living spaces."),
      serviceInArea("carpet-cleaning", "Century City", "Carpet care for lounges and office zones."),
    ],
    faqs: [faq("Century City", "homes"), faq("Century City", "services"), faq("Century City", "equipment")],
  },
  Bellville: {
    regionId: "northern-suburbs",
    localOverview:
      "Bellville serves Northern Suburbs families and small offices with predictable weekday scheduling. Regular home cleaning and move-out handovers are common for rentals near the CBD transport hub.",
    popularServices: [
      serviceInArea("regular-cleaning", "Bellville", "Reliable home upkeep for Northern Suburbs families."),
      serviceInArea("office-cleaning", "Bellville", "Small business and retail-adjacent workspaces."),
      serviceInArea("deep-cleaning", "Bellville", "Periodic intensive cleans for older homes."),
      serviceInArea("moving-cleaning", "Bellville", "Tenant handovers near Bellville CBD."),
    ],
    faqs: [faq("Bellville", "homes"), faq("Bellville", "recurring"), faq("Bellville", "cost")],
  },
  Durbanville: {
    regionId: "northern-suburbs",
    localOverview:
      "Durbanville estates and family homes often need larger-scope deep cleans, regular maintenance, and move-out services before new owners arrive. Wine-route suburbs also book carpet care for entertaining areas.",
    popularServices: [
      serviceInArea("deep-cleaning", "Durbanville", "Estate and family home intensive refreshes."),
      serviceInArea("regular-cleaning", "Durbanville", "Ongoing care for larger suburban homes."),
      serviceInArea("moving-cleaning", "Durbanville", "Handover-ready cleans between owners and tenants."),
      serviceInArea("carpet-cleaning", "Durbanville", "High-traffic living and dining areas."),
    ],
    faqs: [faq("Durbanville", "homes"), faq("Durbanville", "services"), faq("Durbanville", "equipment")],
  },
  "Table View": {
    regionId: "west-coast",
    localOverview:
      "Table View and Blouberg coastal homes deal with sand, sea air, and guest traffic. Regular cleaning keeps day-to-day sand under control, while deep cleans prepare properties before visitors arrive.",
    popularServices: [
      serviceInArea("regular-cleaning", "Table View", "Sand-aware maintenance for coastal homes."),
      serviceInArea("deep-cleaning", "Table View", "Pre-guest and seasonal property refreshes."),
      serviceInArea("airbnb-cleaning", "Table View", "Holiday rental turnovers near the beach."),
      serviceInArea("moving-cleaning", "Table View", "Rental handovers in Bloubergstrand corridors."),
    ],
    faqs: [faq("Table View", "homes"), faq("Table View", "cost"), faq("Table View", "recurring")],
  },
  Milnerton: {
    regionId: "west-coast",
    localOverview:
      "Milnerton and Table Bay homes span townhouses, golf-estate properties, and office-adjacent rentals. Carpet care, regular cleaning, and small office visits are frequently booked through Shalean's online flow.",
    popularServices: [
      serviceInArea("regular-cleaning", "Milnerton", "Townhouse and family home maintenance."),
      serviceInArea("carpet-cleaning", "Milnerton", "Carpet and upholstery refresh for high-traffic rooms."),
      serviceInArea("office-cleaning", "Milnerton", "Offices and home offices near Royal Ascot."),
      serviceInArea("deep-cleaning", "Milnerton", "Intensive cleans before sale or new tenancy."),
    ],
    faqs: [faq("Milnerton", "homes"), faq("Milnerton", "services"), faq("Milnerton", "equipment")],
  },
};

export const LOCATION_AUTHORITY_BY_SLUG: Record<LocationSeoSlug, LocationAuthorityContent> =
  Object.fromEntries(
    CAPE_TOWN_AREAS.map((area) => [
      locationSlugFromArea(area),
      AUTHORITY_BY_AREA[area],
    ]),
  ) as Record<LocationSeoSlug, LocationAuthorityContent>;

export function getLocationAuthority(slug: LocationSeoSlug): LocationAuthorityContent {
  return LOCATION_AUTHORITY_BY_SLUG[slug];
}

export function getLocationReviewForArea(area: string) {
  return REVIEWS.find((review) => review.suburb === area) ?? null;
}

export const PRICING_GUIDANCE_PATH = PRICING_PAGE_PATH;

export function buildPricingGuidanceCopy(area: string): string {
  return `Cleaning prices in ${area} usually depend on service type, home size, extras, and frequency.`;
}

/** Ensures every region includes each area exactly once. */
export function assertLocationRegionsComplete(): void {
  const covered = new Set(LOCATION_REGIONS.flatMap((r) => r.areas));
  for (const area of CAPE_TOWN_AREAS) {
    if (!covered.has(area)) {
      throw new Error(`Area missing from LOCATION_REGIONS: ${area}`);
    }
  }
  if (covered.size !== CAPE_TOWN_AREAS.length) {
    throw new Error("LOCATION_REGIONS contains areas not in CAPE_TOWN_AREAS");
  }
  for (const slug of LOCATION_SEO_SLUGS) {
    const authority = LOCATION_AUTHORITY_BY_SLUG[slug as LocationSeoSlug];
    if (!authority || authority.faqs.length < 3) {
      throw new Error(`Location authority incomplete for ${slug}`);
    }
    if (authority.popularServices.length < 3) {
      throw new Error(`Popular services incomplete for ${slug}`);
    }
  }
}

export function regionAreaHref(area: (typeof CAPE_TOWN_AREAS)[number]): string {
  return areaLocationPath(area);
}
