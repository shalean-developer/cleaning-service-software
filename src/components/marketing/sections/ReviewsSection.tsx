"use client";

import Image from "next/image";
import { REVIEWS } from "@/features/marketing/constants";
import { IconStar } from "../icons";
import { MarketingContainer } from "../MarketingContainer";
import { SectionEyebrow } from "../SectionEyebrow";

export function ReviewsSection() {
  return (
    <section className="marketing-section bg-shalean-surface" aria-labelledby="reviews-heading">
      <MarketingContainer>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionEyebrow>What Our Clients Say</SectionEyebrow>
            <h2
              id="reviews-heading"
              className="mt-3 text-3xl font-bold tracking-tight text-shalean-navy md:text-4xl"
            >
              Real Reviews from Real Customers
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <p className="shrink-0 text-lg font-bold text-shalean-navy">Excellent</p>
              <div className="flex shrink-0 text-shalean-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <IconStar key={i} className="h-4 w-4" />
                ))}
              </div>
              <p className="min-w-0 text-xs text-slate-600 sm:whitespace-nowrap">
                4.9 out of 5 based on 1,200+ reviews
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-blue-600">Google</span>
          </div>
        </div>

        <ul className="mt-10 flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
          {REVIEWS.map((review) => (
            <li
              key={review.name}
              className="w-[min(100%,18.75rem)] shrink-0 snap-start lg:w-auto"
            >
              <article className="flex h-full min-h-[14.5rem] flex-col rounded-[1.25rem] border border-shalean-border bg-white p-6 marketing-card-shadow">
                <div className="flex items-center gap-3">
                  <div className="relative h-[3.25rem] w-[3.25rem] shrink-0 overflow-hidden rounded-full ring-2 ring-shalean-soft-blue">
                    <Image
                      src={review.image}
                      alt={`${review.name} profile photo`}
                      fill
                      sizes="52px"
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-shalean-navy">{review.name}</p>
                    <p className="text-xs text-slate-600">{review.suburb}</p>
                  </div>
                </div>
                <div className="mt-3 flex text-amber-400">
                  {Array.from({ length: review.rating }).map((_, i) => (
                    <IconStar key={i} className="h-4 w-4" />
                  ))}
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                  &ldquo;{review.text}&rdquo;
                </p>
              </article>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex justify-center gap-2 lg:hidden" aria-hidden>
          {REVIEWS.map((review) => (
            <span key={review.name} className="h-2 w-2 rounded-full bg-slate-300 first:bg-shalean-primary first:w-6" />
          ))}
        </div>
      </MarketingContainer>
    </section>
  );
}
