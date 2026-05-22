import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MarketingBookCta } from "@/components/marketing/MarketingBookCta";
import { MarketingInternalLinks } from "@/components/marketing/MarketingInternalLinks";
import { MarketingSeoPageLayout } from "@/components/marketing/MarketingSeoPageLayout";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { serviceFromPrice } from "@/features/marketing/constants";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import {
  SERVICE_SEO_CONTENT,
  SERVICE_SEO_SLUGS,
  isServiceSeoSlug,
  type ServiceSeoSlug,
} from "@/features/marketing/seo-pages";
import {
  buildBreadcrumbSchema,
  buildJsonLdGraph,
  buildServiceSchema,
} from "@/features/marketing/seo";
import { PRICING_PAGE_PATH, SERVICES_HUB_PATH } from "@/features/marketing/seo-pages";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return SERVICE_SEO_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isServiceSeoSlug(slug)) return {};
  const content = SERVICE_SEO_CONTENT[slug];
  return buildMarketingMetadata({
    title: content.metaTitle,
    description: content.metaDescription,
    path: content.path,
  });
}

export default async function ServiceSeoPage({ params }: PageProps) {
  const { slug } = await params;
  if (!isServiceSeoSlug(slug)) notFound();

  const content = SERVICE_SEO_CONTENT[slug];
  const fromPrice = serviceFromPrice(content.serviceSlug);
  const relatedPaths = content.relatedSlugs.map((s) => `/services/${s}`);

  const breadcrumbs = [
    { label: "Home", href: "/", icon: "home" as const },
    { label: "Services", href: SERVICES_HUB_PATH, icon: "services" as const },
    { label: content.title },
  ];

  const schema = buildJsonLdGraph([
    buildServiceSchema(content),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Services", path: SERVICES_HUB_PATH },
      { name: content.title, path: content.path },
    ]),
  ]);

  return (
    <MarketingSeoShell>
      <JsonLdScript data={schema} />
      <MarketingSeoPageLayout
        breadcrumbs={breadcrumbs}
        h1={content.h1}
        intro={content.intro}
        afterIntro={
          <p className="text-sm font-medium text-slate-600">
            From{" "}
            <span className="font-bold text-shalean-primary">{fromPrice}</span>
            {" · "}
            <Link
              href={PRICING_PAGE_PATH}
              className="marketing-focus-ring text-shalean-primary hover:underline"
              aria-label="See cleaning prices in Cape Town"
            >
              See cleaning prices in Cape Town
            </Link>
          </p>
        }
      >
        <div className="mx-auto max-w-3xl space-y-10">
          <p className="text-sm text-slate-600">
            <Link
              href={SERVICES_HUB_PATH}
              className="marketing-focus-ring font-medium text-shalean-primary hover:underline"
              aria-label="View all Shalean cleaning services in Cape Town"
            >
              View all cleaning services in Cape Town
            </Link>
          </p>

          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl">
                {section.heading}
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                {section.body}
              </p>
            </section>
          ))}

          <section>
            <h2 className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl">
              Book {content.title} in Cape Town
            </h2>
            <p className="mt-3 text-base leading-relaxed text-slate-600">
              Create a free account and book online in under two minutes. Choose your date,
              home size, and any add-ons for an instant quote.
            </p>
            <div className="mt-6">
              <MarketingBookCta serviceSlug={content.serviceSlug} />
            </div>
          </section>

          {content.relatedSlugs.length > 0 ? (
            <section>
              <h2 className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl">
                Related services
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {content.relatedSlugs.map((related) => (
                  <li key={related}>
                    <Link
                      href={`/services/${related}`}
                      className="marketing-focus-ring text-sm font-medium text-shalean-primary hover:underline"
                      aria-label={`View ${SERVICE_SEO_CONTENT[related].title} in Cape Town`}
                    >
                      {SERVICE_SEO_CONTENT[related].title} in Cape Town
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <MarketingInternalLinks showServicesHub servicePaths={relatedPaths} />
      </MarketingSeoPageLayout>
    </MarketingSeoShell>
  );
}
