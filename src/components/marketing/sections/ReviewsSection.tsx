import Image from "next/image";
import type { CSSProperties } from "react";
import { REVIEWS, REVIEWS_SECTION, SHALEAN_CONTACT } from "@/features/marketing/constants";
import { IconCheck } from "../icons";
import { MarketingContainer } from "../MarketingContainer";
import { ReviewStars } from "../ReviewStars";
import { SectionEyebrow } from "../SectionEyebrow";

function GoogleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function ReviewsTrustBar() {
  return (
    <div className="reviews-trust-bar flex flex-col gap-4 rounded-3xl border border-slate-200/90 bg-white px-5 py-5 shadow-[0_4px_24px_rgba(15,23,42,0.04)] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6 sm:px-7 sm:py-6 lg:max-w-xl lg:shrink-0">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          <ReviewStars rating={5} size="md" />
          <span className="text-lg font-bold tracking-tight text-shalean-navy">
            {REVIEWS_SECTION.ratingLabel}
          </span>
        </div>
        <p className="text-sm text-slate-600">{REVIEWS_SECTION.reviewCountLabel}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-shalean-soft-blue/60 px-3 py-1 text-xs font-semibold tracking-wide text-shalean-primary">
          {REVIEWS_SECTION.excellentLabel}
        </span>
        <a
          href={SHALEAN_CONTACT.googleReviewsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="marketing-focus-ring inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50/80 px-3 py-1.5 text-sm font-semibold text-shalean-navy transition hover:border-shalean-primary/30 hover:bg-white"
          aria-label={`Read ${REVIEWS_SECTION.reviewCountLabel} on Google. Opens in a new tab`}
        >
          <GoogleMark className="h-4 w-4" />
          Google Reviews
        </a>
      </div>
    </div>
  );
}

type ReviewCardProps = {
  review: (typeof REVIEWS)[number];
  index: number;
};

function ReviewCard({ review, index }: ReviewCardProps) {
  return (
    <li
      className="reviews-card marketing-card-hover w-[min(100%,20.5rem)] shrink-0 snap-center sm:w-[min(100%,21rem)] md:w-auto"
      style={{ "--review-index": index } as CSSProperties}
    >
      <article className="flex h-full min-h-[18.5rem] flex-col rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7">
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

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <ReviewStars rating={review.rating} size="sm" />
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-wide text-slate-500">
            <IconCheck className="h-3.5 w-3.5 text-shalean-primary" aria-hidden />
            Verified booking
          </span>
        </div>

        <blockquote className="mt-5 flex-1 border-t border-slate-100 pt-5">
          <p className="text-[0.9375rem] leading-relaxed text-slate-600">
            &ldquo;{review.text}&rdquo;
          </p>
        </blockquote>
      </article>
    </li>
  );
}

function reviewsJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Shalean Cleaning Services",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: REVIEWS_SECTION.ratingValue,
      reviewCount: "1200",
      bestRating: "5",
    },
    review: REVIEWS.map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.name },
      reviewRating: {
        "@type": "Rating",
        ratingValue: String(review.rating),
        bestRating: "5",
      },
      reviewBody: review.text,
    })),
  };
}

export function ReviewsSection() {
  const jsonLd = reviewsJsonLd();

  return (
    <section
      id="reviews"
      className="marketing-section relative bg-white"
      aria-labelledby="reviews-heading"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <MarketingContainer>
        <header className="mx-auto max-w-3xl text-center">
          <SectionEyebrow className="tracking-[0.14em] text-shalean-primary">
            {REVIEWS_SECTION.eyebrow}
          </SectionEyebrow>
          <h2
            id="reviews-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-shalean-navy sm:text-4xl lg:text-[2.5rem] lg:leading-[1.12]"
          >
            {REVIEWS_SECTION.heading}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
            {REVIEWS_SECTION.subtitle}
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-8 lg:mt-12 lg:flex-row lg:items-center lg:justify-between">
          <ReviewsTrustBar />
        </div>

        <div className="relative mt-10 lg:mt-12">
          <ul
            className="reviews-scroll flex gap-5 overflow-x-auto pb-2 pl-0.5 snap-x snap-mandatory scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-6 md:grid md:grid-cols-2 md:overflow-visible md:pb-0 lg:grid-cols-4 lg:gap-6 [&::-webkit-scrollbar]:hidden"
            aria-label="Customer reviews"
          >
            {REVIEWS.map((review, index) => (
              <ReviewCard key={review.name} review={review} index={index} />
            ))}
          </ul>
          <p className="mt-4 text-center text-sm text-slate-500 md:hidden">
            Swipe to read more reviews
          </p>
        </div>
      </MarketingContainer>
    </section>
  );
}
