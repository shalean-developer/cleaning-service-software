import type { Metadata } from "next";
import Link from "next/link";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MarketingBookCta } from "@/components/marketing/MarketingBookCta";
import { MarketingInternalLinks } from "@/components/marketing/MarketingInternalLinks";
import { MarketingSeoPageLayout } from "@/components/marketing/MarketingSeoPageLayout";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import {
  ALL_PRICING_ROWS,
  PRICING_PAGE_FAQS,
  PRICING_PAGE_PATH,
} from "@/features/marketing/seo-pages";
import {
  buildBreadcrumbSchema,
  buildFaqPageSchema,
  buildJsonLdGraph,
} from "@/features/marketing/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Cleaning Prices Cape Town | Shalean",
  description:
    "Transparent cleaning prices in Cape Town for regular, deep, move in/out, Airbnb, office, and carpet cleaning. Book online with instant quotes.",
  path: PRICING_PAGE_PATH,
});

export default function CleaningPricesPage() {
  const schema = buildJsonLdGraph([
    buildFaqPageSchema(PRICING_PAGE_FAQS),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Cleaning Prices", path: PRICING_PAGE_PATH },
    ]),
  ]);

  return (
    <MarketingSeoShell>
      <JsonLdScript data={schema} />
      <MarketingSeoPageLayout
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Cleaning Prices" },
        ]}
        h1="Cleaning Prices in Cape Town"
        intro="Shalean offers upfront pricing for home and office cleaning across Cape Town. Starting prices below cover a standard scope — your final quote reflects bedrooms, bathrooms, property size, and add-ons."
        afterIntro={<MarketingBookCta />}
      >
        <div className="mx-auto max-w-3xl">
          <section aria-labelledby="pricing-table-heading">
            <h2
              id="pricing-table-heading"
              className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl"
            >
              Service pricing summary
            </h2>
            <ul className="mt-6 divide-y divide-slate-200/90 rounded-2xl border border-slate-200/90 bg-white">
              {ALL_PRICING_ROWS.map((row) => (
                <li
                  key={row.slug}
                  className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-4 sm:px-6"
                >
                  <Link
                    href={row.path}
                    className="marketing-focus-ring font-medium text-shalean-navy hover:text-shalean-primary"
                  >
                    {row.name}
                  </Link>
                  <span className="text-sm text-slate-600">
                    From{" "}
                    <span className="font-bold text-shalean-primary">{row.fromPrice}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-500">
              No hidden costs. Pay securely online when you book.
            </p>
          </section>

          <section className="mt-12" aria-labelledby="pricing-faq-heading">
            <h2
              id="pricing-faq-heading"
              className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl"
            >
              Pricing FAQs
            </h2>
            <dl className="mt-6 space-y-6">
              {PRICING_PAGE_FAQS.map((item) => (
                <div key={item.question}>
                  <dt className="font-semibold text-shalean-navy">{item.question}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-slate-600">
                    {item.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <MarketingInternalLinks
          showServicesHub
          servicePaths={ALL_PRICING_ROWS.map((r) => r.path)}
        />
      </MarketingSeoPageLayout>
    </MarketingSeoShell>
  );
}
