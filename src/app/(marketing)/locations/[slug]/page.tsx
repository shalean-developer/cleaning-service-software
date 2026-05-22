import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MarketingBookCta } from "@/components/marketing/MarketingBookCta";
import { MarketingInternalLinks } from "@/components/marketing/MarketingInternalLinks";
import { MarketingSeoPageLayout } from "@/components/marketing/MarketingSeoPageLayout";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { MARKETING_SERVICES, SERVICE_SEO_PATHS } from "@/features/marketing/constants";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import { LOCATIONS_HUB_PATH, LOCATION_SEO_SLUGS } from "@/features/marketing/marketing-routes";
import { LOCATION_SEO_CONTENT, isLocationSeoSlug } from "@/features/marketing/seo-pages";
import {
  buildBreadcrumbSchema,
  buildJsonLdGraph,
  buildLocationBusinessSchema,
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
  const schema = buildJsonLdGraph([
    buildLocationBusinessSchema(content),
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
        <div className="mx-auto max-w-3xl space-y-10">
          <section>
            <h2 className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl">
              Cleaning in {content.area}
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              {content.localNote}
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl">
              Services available in {content.area}
            </h2>
            <ul className="mt-4 flex flex-col gap-2">
              {MARKETING_SERVICES.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={SERVICE_SEO_PATHS[service.slug]}
                    className="marketing-focus-ring text-sm font-medium text-shalean-primary hover:underline"
                  >
                    {service.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <MarketingInternalLinks
          showServicesHub
          servicePaths={MARKETING_SERVICES.map((s) => SERVICE_SEO_PATHS[s.slug])}
        />
      </MarketingSeoPageLayout>
    </MarketingSeoShell>
  );
}
