import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { LocationSuburbAuthoritySections } from "@/components/marketing/LocationSuburbAuthoritySections";
import { MarketingBookCta } from "@/components/marketing/MarketingBookCta";
import { MarketingInternalLinks } from "@/components/marketing/MarketingInternalLinks";
import { MarketingSeoPageLayout } from "@/components/marketing/MarketingSeoPageLayout";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { getLocationAuthority } from "@/features/marketing/locationAuthorityContent";
import { SERVICE_SEO_PATHS } from "@/features/marketing/constants";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import { LOCATIONS_HUB_PATH, LOCATION_SEO_SLUGS } from "@/features/marketing/marketing-routes";
import { LOCATION_SEO_CONTENT, isLocationSeoSlug } from "@/features/marketing/seo-pages";
import {
  buildBreadcrumbSchema,
  buildFaqPageSchema,
  buildJsonLdGraph,
  buildLocationSuburbWebPageSchema,
  buildOrganizationSchema,
} from "@/features/marketing/seo";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return LOCATION_SEO_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isLocationSeoSlug(slug)) return {};
  const content = LOCATION_SEO_CONTENT[slug];
  return buildMarketingMetadata({
    title: content.metaTitle,
    description: content.metaDescription,
    path: content.path,
  });
}

export default async function LocationSeoPage({ params }: PageProps) {
  const { slug } = await params;
  if (!isLocationSeoSlug(slug)) notFound();

  const content = LOCATION_SEO_CONTENT[slug];
  const authority = getLocationAuthority(content.slug);
  const schema = buildJsonLdGraph([
    buildOrganizationSchema(),
    buildLocationSuburbWebPageSchema(content),
    buildFaqPageSchema(authority.faqs),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Locations", path: LOCATIONS_HUB_PATH },
      { name: content.area, path: content.path },
    ]),
  ]);

  return (
    <MarketingSeoShell>
      <JsonLdScript data={schema} />
      <MarketingSeoPageLayout
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Locations", href: LOCATIONS_HUB_PATH },
          { label: content.area },
        ]}
        h1={content.h1}
        intro={content.intro}
        afterIntro={<MarketingBookCta />}
      >
        <LocationSuburbAuthoritySections content={content} />

        <MarketingInternalLinks
          showServicesHub
          showReviews
          servicePaths={authority.popularServices.map((s) => s.href)}
        />
      </MarketingSeoPageLayout>
    </MarketingSeoShell>
  );
}
