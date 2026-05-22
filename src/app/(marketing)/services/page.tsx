import type { Metadata } from "next";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MarketingBreadcrumbs } from "@/components/marketing/MarketingBreadcrumbs";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { ServicesHubSections } from "@/components/marketing/services-hub/ServicesHubSections";
import { MARKETING_SERVICES, SERVICE_SEO_PATHS } from "@/features/marketing/constants";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import { SERVICES_HUB_HERO } from "@/features/marketing/services-hub-content";
import { SERVICES_HUB_PATH } from "@/features/marketing/seo-pages";
import {
  buildBreadcrumbSchema,
  buildCollectionPageSchema,
  buildItemListSchema,
  buildJsonLdGraph,
} from "@/features/marketing/seo";

const HUB_DESCRIPTION =
  "Explore Shalean's professional cleaning services in Cape Town. regular, deep, move-in/out, Airbnb, office and carpet cleaning. Vetted cleaners, secure booking, and transparent pricing.";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Cleaning Services Cape Town | Shalean",
  description: HUB_DESCRIPTION,
  path: SERVICES_HUB_PATH,
});

export default function ServicesHubPage() {
  const serviceListItems = MARKETING_SERVICES.map((service) => ({
    name: service.title,
    path: SERVICE_SEO_PATHS[service.slug],
  }));

  const schema = buildJsonLdGraph([
    buildCollectionPageSchema({
      name: SERVICES_HUB_HERO.h1,
      description: HUB_DESCRIPTION,
      path: SERVICES_HUB_PATH,
    }),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Services", path: SERVICES_HUB_PATH },
    ]),
    buildItemListSchema(serviceListItems),
  ]);

  return (
    <MarketingSeoShell>
      <JsonLdScript data={schema} />
      <ServicesHubSections
        heroAfterBreadcrumbs={
          <MarketingBreadcrumbs
            items={[
              { label: "Home", href: "/", icon: "home" },
              { label: "Services", icon: "services" },
            ]}
          />
        }
      />
    </MarketingSeoShell>
  );
}
