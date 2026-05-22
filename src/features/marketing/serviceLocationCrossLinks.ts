import { areaLocationPath, CAPE_TOWN_AREAS } from "./constants";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { LOCATIONS_HUB_PATH, locationSlugFromArea, type LocationSeoSlug } from "./marketing-routes";
import { serviceSlugFromSeoSlug, type ServiceSeoSlug } from "./seo-pages";

export type ServiceAreaCrossLink = {
  area: (typeof CAPE_TOWN_AREAS)[number];
  slug: LocationSeoSlug;
  href: string;
  anchorText: string;
};

export type ServiceLocationCrossLinkConfig = {
  serviceSlug: ServiceSlug;
  introCopy: string;
  featuredAreas: readonly (typeof CAPE_TOWN_AREAS)[number][];
};

const SERVICE_AREA_LABEL: Record<ServiceSlug, (area: string) => string> = {
  "regular-cleaning": (area) => `Regular cleaning in ${area}`,
  "deep-cleaning": (area) => `Deep cleaning in ${area}`,
  "moving-cleaning": (area) => `Move-in/out cleaning in ${area}`,
  "airbnb-cleaning": (area) => `Airbnb cleaning in ${area}`,
  "office-cleaning": (area) => `Office cleaning in ${area}`,
  "carpet-cleaning": (area) => `Carpet cleaning in ${area}`,
};

export const SERVICE_LOCATION_CROSS_LINKS: Record<ServiceSlug, ServiceLocationCrossLinkConfig> = {
  "regular-cleaning": {
    serviceSlug: "regular-cleaning",
    introCopy:
      "Regular home cleaning is popular across Cape Town suburbs. from Atlantic Seaboard apartments to Southern Suburbs family homes.",
    featuredAreas: [
      "Sea Point",
      "Claremont",
      "Camps Bay",
      "Rondebosch",
      "Wynberg",
      "Observatory",
      "Durbanville",
      "Table View",
    ],
  },
  "deep-cleaning": {
    serviceSlug: "deep-cleaning",
    introCopy:
      "Deep cleaning is often booked before events, seasonal refreshes, and tenant handovers in these Cape Town neighbourhoods.",
    featuredAreas: [
      "Claremont",
      "Rondebosch",
      "Wynberg",
      "Sea Point",
      "Durbanville",
      "Bellville",
      "Milnerton",
      "Green Point",
    ],
  },
  "moving-cleaning": {
    serviceSlug: "moving-cleaning",
    introCopy:
      "Move-in and move-out cleaning helps tenants, landlords, and buyers meet handover standards across the metro.",
    featuredAreas: [
      "Rondebosch",
      "Claremont",
      "Sea Point",
      "Milnerton",
      "Century City",
      "Bellville",
      "Table View",
      "Wynberg",
    ],
  },
  "airbnb-cleaning": {
    serviceSlug: "airbnb-cleaning",
    introCopy:
      "Short-term rental hosts in coastal and CBD-adjacent suburbs rely on fast turnovers between guest check-out and check-in.",
    featuredAreas: [
      "Sea Point",
      "Camps Bay",
      "Green Point",
      "Observatory",
      "Century City",
      "Table View",
      "Claremont",
      "Milnerton",
    ],
  },
  "office-cleaning": {
    serviceSlug: "office-cleaning",
    introCopy:
      "Office and workspace cleaning is common near business parks, canalside offices, and mixed-use precincts in these areas.",
    featuredAreas: [
      "Century City",
      "Bellville",
      "Claremont",
      "Green Point",
      "Milnerton",
      "Durbanville",
      "Sea Point",
      "Observatory",
    ],
  },
  "carpet-cleaning": {
    serviceSlug: "carpet-cleaning",
    introCopy:
      "Carpet and upholstery care suits family lounges, rental refreshes, and office zones with high foot traffic.",
    featuredAreas: [
      "Century City",
      "Bellville",
      "Claremont",
      "Sea Point",
      "Durbanville",
      "Milnerton",
      "Rondebosch",
      "Table View",
    ],
  },
};

export const LOCATIONS_HUB_CROSS_LINK = {
  href: LOCATIONS_HUB_PATH,
  label: "View all Cape Town service areas",
} as const;

/** Pricing hub: suburb discovery without implying suburb-specific prices. */
export const PRICING_HUB_FEATURED_AREAS: readonly (typeof CAPE_TOWN_AREAS)[number][] = [
  "Sea Point",
  "Claremont",
  "Century City",
  "Camps Bay",
  "Bellville",
  "Durbanville",
  "Table View",
  "Green Point",
] as const;

export function pricingAreaAnchorText(area: string): string {
  return `Cleaning services in ${area}`;
}

export function buildServiceAreaCrossLink(
  serviceSlug: ServiceSlug,
  area: (typeof CAPE_TOWN_AREAS)[number],
): ServiceAreaCrossLink {
  const slug = locationSlugFromArea(area);
  return {
    area,
    slug,
    href: areaLocationPath(area),
    anchorText: SERVICE_AREA_LABEL[serviceSlug](area),
  };
}

export function getServiceLocationCrossLinks(
  serviceSlug: ServiceSlug,
): ServiceLocationCrossLinkConfig & { links: ServiceAreaCrossLink[] } {
  const config = SERVICE_LOCATION_CROSS_LINKS[serviceSlug];
  const links = config.featuredAreas.map((area) => buildServiceAreaCrossLink(serviceSlug, area));
  return { ...config, links };
}

export function getServiceLocationCrossLinksBySeoSlug(seoSlug: ServiceSeoSlug) {
  return getServiceLocationCrossLinks(serviceSlugFromSeoSlug(seoSlug));
}

/** Areas that receive at least one inbound link from a service money page. */
export function getServicePageInboundAreaCoverage(): Map<
  (typeof CAPE_TOWN_AREAS)[number],
  ServiceSlug[]
> {
  const coverage = new Map<(typeof CAPE_TOWN_AREAS)[number], ServiceSlug[]>();
  for (const area of CAPE_TOWN_AREAS) {
    coverage.set(area, []);
  }
  for (const [serviceSlug, config] of Object.entries(SERVICE_LOCATION_CROSS_LINKS) as [
    ServiceSlug,
    ServiceLocationCrossLinkConfig,
  ][]) {
    for (const area of config.featuredAreas) {
      coverage.get(area)!.push(serviceSlug);
    }
  }
  return coverage;
}

export function assertAllAreasReceiveServiceInboundLinks(): void {
  const coverage = getServicePageInboundAreaCoverage();
  const missing = CAPE_TOWN_AREAS.filter((area) => (coverage.get(area)?.length ?? 0) === 0);
  if (missing.length > 0) {
    throw new Error(`Areas missing service-page inbound links: ${missing.join(", ")}`);
  }
}

export function assertServiceCrossLinkPathsCanonical(): void {
  for (const serviceSlug of Object.keys(SERVICE_LOCATION_CROSS_LINKS) as ServiceSlug[]) {
    const { links } = getServiceLocationCrossLinks(serviceSlug);
    for (const link of links) {
      if (!link.href.startsWith("/locations/")) {
        throw new Error(`Invalid location path: ${link.href}`);
      }
      if (!link.href.endsWith("-cape-town")) {
        throw new Error(`Non-canonical location slug in href: ${link.href}`);
      }
      if (link.href.includes("/locations/") && link.href.split("/").length !== 3) {
        // /locations/sea-point-cape-town
      }
      const segment = link.href.replace("/locations/", "");
      if (segment !== link.slug) {
        throw new Error(`Href/slug mismatch: ${link.href} vs ${link.slug}`);
      }
    }
  }
}
