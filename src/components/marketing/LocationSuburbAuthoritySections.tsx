import Link from "next/link";
import {
  buildPricingGuidanceCopy,
  getLocationAuthority,
  getLocationReviewForArea,
  LOCATION_PROOF_HEADLINE,
  LOCATION_TRUST_POINTS,
  PRICING_GUIDANCE_PATH,
} from "@/features/marketing/locationAuthorityContent";
import { LocationNearbyAreasSection } from "@/components/marketing/LocationNearbyAreasSection";
import { REVIEWS_PAGE_PATH } from "@/features/marketing/marketing-routes";
import type { LocationSeoContent } from "@/features/marketing/seo-pages";

const sectionHeading =
  "text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl";

type Props = {
  content: LocationSeoContent;
};

export function LocationSuburbAuthoritySections({ content }: Props) {
  const authority = getLocationAuthority(content.slug);
  const review = getLocationReviewForArea(content.area);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section aria-labelledby="local-overview-heading">
        <h2 id="local-overview-heading" className={sectionHeading}>
          Local cleaning in {content.area}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">{authority.localOverview}</p>
        <p className="mt-3 text-base leading-relaxed text-slate-600">{content.localNote}</p>
      </section>

      <section aria-labelledby="popular-services-heading">
        <h2 id="popular-services-heading" className={sectionHeading}>
          Popular services in {content.area}
        </h2>
        <ul className="mt-4 space-y-4">
          {authority.popularServices.map((service) => (
            <li key={service.slug} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
              <Link
                href={service.href}
                className="marketing-focus-ring text-sm font-semibold text-shalean-primary hover:underline"
              >
                {service.linkLabel}
              </Link>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{service.blurb}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pricing-guidance-heading">
        <h2 id="pricing-guidance-heading" className={sectionHeading}>
          Cleaning prices in {content.area}
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          {buildPricingGuidanceCopy(content.area)}{" "}
          <Link
            href={PRICING_GUIDANCE_PATH}
            className="marketing-focus-ring font-medium text-shalean-primary hover:underline"
          >
            View Cape Town cleaning prices
          </Link>{" "}
          for starting rates by service type before you book.
        </p>
      </section>

      <section aria-labelledby="trust-heading">
        <h2 id="trust-heading" className={sectionHeading}>
          Why book Shalean in {content.area}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {LOCATION_TRUST_POINTS.map((point) => (
            <li
              key={point.title}
              className="rounded-xl border border-shalean-soft-blue/50 bg-shalean-soft-blue/25 px-4 py-3"
            >
              <p className="text-sm font-semibold text-shalean-navy">{point.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{point.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="proof-heading">
        <h2 id="proof-heading" className={sectionHeading}>
          Trusted in Cape Town
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">{LOCATION_PROOF_HEADLINE}</p>
        {review ? (
          <figure className="mt-4 rounded-xl border border-slate-200/90 bg-white p-5">
            <blockquote className="text-sm leading-relaxed text-slate-600">
              &ldquo;{review.text}&rdquo;
            </blockquote>
            <figcaption className="mt-3 text-xs font-medium text-slate-500">
              {review.name} · {review.suburb} · {review.context}
            </figcaption>
          </figure>
        ) : null}
        <p className="mt-4">
          <Link
            href={REVIEWS_PAGE_PATH}
            className="marketing-focus-ring text-sm font-semibold text-shalean-primary hover:underline"
          >
            Read customer reviews
          </Link>
        </p>
      </section>

      <section aria-labelledby="location-faq-heading">
        <h2 id="location-faq-heading" className={sectionHeading}>
          {content.area} cleaning FAQs
        </h2>
        <dl className="mt-6 space-y-6">
          {authority.faqs.map((item) => (
            <div key={item.question}>
              <dt className="font-semibold text-shalean-navy">{item.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate-600">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      <LocationNearbyAreasSection slug={content.slug} />
    </div>
  );
}
