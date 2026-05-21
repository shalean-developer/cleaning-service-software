import type { Metadata } from "next";
import Image from "next/image";
import { JsonLdScript } from "@/components/marketing/JsonLdScript";
import { MarketingBookCta } from "@/components/marketing/MarketingBookCta";
import { MarketingInternalLinks } from "@/components/marketing/MarketingInternalLinks";
import { MarketingSeoPageLayout } from "@/components/marketing/MarketingSeoPageLayout";
import { MarketingSeoShell } from "@/components/marketing/MarketingSeoShell";
import { ReviewStars } from "@/components/marketing/ReviewStars";
import {
  REVIEWS,
  REVIEWS_SECTION,
  SHALEAN_CONTACT,
} from "@/features/marketing/constants";
import { buildMarketingMetadata } from "@/features/marketing/metadata";
import { REVIEWS_PAGE_PATH } from "@/features/marketing/seo-pages";
import {
  buildBreadcrumbSchema,
  buildJsonLdGraph,
  buildLocalBusinessSchema,
} from "@/features/marketing/seo";

export const metadata: Metadata = buildMarketingMetadata({
  title: "Shalean Cleaning Reviews Cape Town",
  description:
    "Read what Cape Town customers say about Shalean home, deep, and Airbnb cleaning. Book online with vetted, insured cleaners.",
  path: REVIEWS_PAGE_PATH,
});

export default function ReviewsPage() {
  const schema = buildJsonLdGraph([
    buildLocalBusinessSchema(),
    buildBreadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Reviews", path: REVIEWS_PAGE_PATH },
    ]),
  ]);

  return (
    <MarketingSeoShell>
      <JsonLdScript data={schema} />
      <MarketingSeoPageLayout
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Reviews" },
        ]}
        h1="Customer Reviews"
        intro={REVIEWS_SECTION.subtitle}
        afterIntro={
          <div className="flex flex-wrap items-center gap-4">
            <ReviewStars rating={5} size="md" />
            <span className="text-sm text-slate-600">{REVIEWS_SECTION.reviewCountLabel}</span>
            <a
              href={SHALEAN_CONTACT.googleReviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="marketing-focus-ring text-sm font-semibold text-shalean-primary hover:underline"
            >
              Read on Google
            </a>
          </div>
        }
      >
        <ul className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-2">
          {REVIEWS.map((review) => (
            <li key={review.name}>
              <article className="flex h-full flex-col rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7">
                <header className="flex items-start gap-3.5">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-shalean-soft-blue ring-offset-2 ring-offset-white">
                    <Image
                      src={review.image}
                      alt={`${review.name}, Shalean customer`}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-shalean-navy">{review.name}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{review.suburb}, Cape Town</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">{review.context}</p>
                  </div>
                </header>
                <div className="mt-4">
                  <ReviewStars rating={review.rating} size="sm" />
                </div>
                <blockquote className="mt-4 flex-1 border-t border-slate-100 pt-4">
                  <p className="text-[0.9375rem] leading-relaxed text-slate-600">
                    &ldquo;{review.text}&rdquo;
                  </p>
                </blockquote>
              </article>
            </li>
          ))}
        </ul>

        <div className="mx-auto mt-12 max-w-3xl">
          <MarketingBookCta label="Book your clean" />
        </div>

        <MarketingInternalLinks />
      </MarketingSeoPageLayout>
    </MarketingSeoShell>
  );
}
