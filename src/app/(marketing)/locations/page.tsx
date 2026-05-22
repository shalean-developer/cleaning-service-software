import type { Metadata } from "next";
import Link from "next/link";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MarketingBookCta } from "@/components/marketing/MarketingBookCta";
import { MarketingInternalLinks } from "@/components/marketing/MarketingInternalLinks";
import { MarketingSeoPageLayout } from "@/components/marketing/MarketingSeoPageLayout";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { CAPE_TOWN_AREAS, areaLocationPath } from "@/features/marketing/constants";
import { cleaningServicesInAreaLabel } from "@/features/marketing/locationNearbyAreas";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import { LOCATIONS_HUB_PATH } from "@/features/marketing/seo-pages";
import {
  buildBreadcrumbSchema,
  buildItemListSchema,
  buildJsonLdGraph,
  buildLocationsHubWebPageSchema,
  buildOrganizationSchema,
} from "@/features/marketing/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Cleaning Service Areas Cape Town | Shalean",
  description:
    "Shalean cleaning services across Cape Town suburbs — Sea Point, Claremont, Camps Bay, Century City, Bellville, and more.",
  path: LOCATIONS_HUB_PATH,
});

const HUB_DESCRIPTION =
  "Professional home and office cleaning across Cape Town suburbs. Book vetted Shalean cleaners online.";

export default function LocationsHubPage() {
  const locationListItems = CAPE_TOWN_AREAS.map((area) => ({
    name: cleaningServicesInAreaLabel(area),
    path: areaLocationPath(area),
  }));

  const schema = buildJsonLdGraph([
    buildOrganizationSchema({ description: HUB_DESCRIPTION }),
    buildLocationsHubWebPageSchema({
      name: "Cleaning Services Across Cape Town",
      description: HUB_DESCRIPTION,
      path: LOCATIONS_HUB_PATH,
    }),
    buildItemListSchema(locationListItems),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Locations", path: LOCATIONS_HUB_PATH },
    ]),
  ]);

  return (
    <MarketingSeoShell>
      <JsonLdScript data={schema} />
      <MarketingSeoPageLayout
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Locations" },
        ]}
        h1="Cleaning Services Across Cape Town"
        intro="Shalean serves homeowners, hosts, and businesses across the Cape Town metro. Select your suburb below for local service details and booking."
        afterIntro={<MarketingBookCta />}
      >
        <section className="mx-auto max-w-3xl" aria-labelledby="areas-list-heading">
          <h2
            id="areas-list-heading"
            className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl"
          >
            Suburbs we serve
          </h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {CAPE_TOWN_AREAS.map((area) => (
              <li key={area}>
                <Link
                  href={areaLocationPath(area)}
                  className="marketing-focus-ring inline-flex min-h-9 max-w-full items-center justify-center rounded-full border border-shalean-soft-blue/80 bg-shalean-soft-blue/50 px-3.5 py-1.5 text-sm font-medium text-shalean-primary transition hover:border-shalean-primary/35 hover:bg-shalean-soft-blue"
                  aria-label={cleaningServicesInAreaLabel(area)}
                >
                  {cleaningServicesInAreaLabel(area)}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <MarketingInternalLinks showLocations={false} showServicesHub />
      </MarketingSeoPageLayout>
    </MarketingSeoShell>
  );
}
