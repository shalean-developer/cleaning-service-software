import type { Metadata } from "next";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MarketingBookCta } from "@/components/marketing/MarketingBookCta";
import { MarketingInternalLinks } from "@/components/marketing/MarketingInternalLinks";
import { MarketingSeoPageLayout } from "@/components/marketing/MarketingSeoPageLayout";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { CAPE_TOWN_AREAS, areaLocationPath } from "@/features/marketing/constants";
import { LocationsHubRegionsSection } from "@/components/marketing/LocationsHubRegionsSection";
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
        <LocationsHubRegionsSection />

        <MarketingInternalLinks showLocations={false} showServicesHub showReviews />
      </MarketingSeoPageLayout>
    </MarketingSeoShell>
  );
}
