import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { MarketingButton } from "@/components/marketing/MarketingButton";
import { MarketingContainer } from "@/components/marketing/MarketingContainer";
import { MarketingInternalLinks } from "@/components/marketing/MarketingInternalLinks";
import { ReviewStars } from "@/components/marketing/ReviewStars";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import {
  IconArrowRight,
  IconCalendar,
  IconCreditCard,
  IconGrid,
  IconHome,
  IconLock,
  IconMapPin,
  IconShield,
  IconSparkle,
  IconUser,
  IconUsers,
} from "@/components/marketing/icons";
import { REVIEWS, SHALEAN_CONTACT } from "@/features/marketing/constants";
import {
  ABOUT_PAGE_CAREERS,
  ABOUT_PAGE_FAQ,
  ABOUT_PAGE_FINAL_CTA,
  ABOUT_PAGE_HERO,
  ABOUT_PAGE_HOW_IT_WORKS,
  ABOUT_PAGE_LOCAL,
  ABOUT_PAGE_MISSION,
  ABOUT_PAGE_OPERATIONS,
  ABOUT_PAGE_SOCIAL_PROOF,
  ABOUT_PAGE_TRUST_SAFETY,
  ABOUT_PAGE_WHO_WE_SERVE,
  aboutAreaHref,
} from "@/features/marketing/about-page-content";
import {
  LOCATIONS_HUB_PATH,
  PRICING_PAGE_PATH,
  REVIEWS_PAGE_PATH,
  SERVICES_HUB_PATH,
} from "@/features/marketing/marketing-routes";

const sectionRule = "border-t border-slate-200/70";
const sectionPad = "py-14 sm:py-16 lg:py-20";

const OPERATION_ICONS = {
  vetted: IconShield,
  dispatch: IconUsers,
  recurring: IconCalendar,
  support: IconUser,
  booking: IconCreditCard,
  coverage: IconMapPin,
} as const;

const TRUST_ICONS = {
  verification: IconShield,
  escalation: IconUser,
  monitoring: IconGrid,
  payments: IconLock,
} as const;

const SERVE_ICONS = {
  homes: IconHome,
  airbnb: IconSparkle,
  offices: IconGrid,
  managers: IconUsers,
  families: IconHome,
  recurring: IconCalendar,
} as const;

const STEP_ICONS = [IconCalendar, IconUsers, IconMapPin, IconSparkle, IconCalendar] as const;

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  id,
  centered,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  id: string;
  centered?: boolean;
}) {
  return (
    <header className={`max-w-3xl ${centered ? "mx-auto text-center" : ""}`}>
      {eyebrow ? (
        <SectionEyebrow className="tracking-[0.12em] text-shalean-primary">
          {eyebrow}
        </SectionEyebrow>
      ) : null}
      <h2
        id={id}
        className={`${eyebrow ? "mt-4" : ""} text-2xl font-bold tracking-tight text-shalean-navy sm:text-3xl lg:text-[2rem] lg:leading-[1.15]`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{subtitle}</p>
      ) : null}
    </header>
  );
}

type AboutPageSectionsProps = {
  heroAfterBreadcrumbs?: ReactNode;
};

export function AboutPageSections({ heroAfterBreadcrumbs }: AboutPageSectionsProps) {
  const previewReviews = REVIEWS.slice(0, 2);

  return (
    <>
      {/* Hero */}
      <section
        className="relative overflow-hidden bg-gradient-to-b from-white via-white to-shalean-surface"
        aria-labelledby="about-hero-heading"
      >
        <MarketingContainer className="py-10 sm:py-14 lg:py-16">
          {heroAfterBreadcrumbs}
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14 xl:gap-16">
            <div className="min-w-0 lg:max-w-xl">
              <SectionEyebrow className="tracking-[0.12em] text-shalean-primary">
                {ABOUT_PAGE_HERO.eyebrow}
              </SectionEyebrow>
              <h1
                id="about-hero-heading"
                className="mt-4 text-[2rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-shalean-navy sm:text-4xl lg:text-[2.75rem]"
              >
                {ABOUT_PAGE_HERO.h1}
              </h1>
              <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg sm:leading-[1.65]">
                {ABOUT_PAGE_HERO.intro}
              </p>
              <p className="mt-5 text-sm font-medium tracking-wide text-slate-500">
                {ABOUT_PAGE_HERO.trustLine}
              </p>
              <div className="mt-8 flex flex-wrap gap-3 sm:mt-10">
                <MarketingButton
                  href={ABOUT_PAGE_FINAL_CTA.book.href}
                  className="!rounded-2xl !px-7"
                  aria-label="Book a cleaning in Cape Town"
                >
                  Book a cleaning
                </MarketingButton>
                <MarketingButton
                  href={SERVICES_HUB_PATH}
                  variant="secondary"
                  className="!rounded-2xl !px-7"
                  aria-label="Explore Shalean cleaning services"
                >
                  Explore services
                </MarketingButton>
              </div>
            </div>
            <div className="relative min-h-[16rem] overflow-hidden rounded-3xl bg-slate-100 shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:min-h-[20rem] lg:min-h-[24rem]">
              <Image
                src={ABOUT_PAGE_HERO.image}
                alt={ABOUT_PAGE_HERO.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-shalean-navy/25 via-transparent to-transparent"
                aria-hidden
              />
            </div>
          </div>
        </MarketingContainer>
      </section>

      {/* Mission */}
      <section
        className={`${sectionRule} bg-gradient-to-b from-shalean-soft-blue/50 via-white to-white py-16 sm:py-20 lg:py-24`}
        aria-label="Shalean mission"
      >
        <MarketingContainer>
          <blockquote className="mx-auto max-w-3xl text-center">
            <p className="font-serif text-2xl font-medium leading-snug tracking-tight text-shalean-navy sm:text-3xl sm:leading-[1.35] lg:text-[2rem]">
              &ldquo;{ABOUT_PAGE_MISSION.quote}&rdquo;
            </p>
            <footer className="mt-6 text-sm font-medium tracking-wide text-slate-500">
              {ABOUT_PAGE_MISSION.attribution}
            </footer>
          </blockquote>
        </MarketingContainer>
      </section>

      {/* Operational credibility */}
      <section
        className={`${sectionRule} bg-white ${sectionPad}`}
        aria-labelledby="about-operations-heading"
      >
        <MarketingContainer>
          <SectionHeader
            eyebrow={ABOUT_PAGE_OPERATIONS.eyebrow}
            id="about-operations-heading"
            title={ABOUT_PAGE_OPERATIONS.title}
            subtitle={ABOUT_PAGE_OPERATIONS.subtitle}
          />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-6">
            {ABOUT_PAGE_OPERATIONS.cards.map((card) => {
              const Icon = OPERATION_ICONS[card.id as keyof typeof OPERATION_ICONS] ?? IconShield;
              return (
                <li key={card.id}>
                  <article className="flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-6 transition duration-200 hover:border-shalean-primary/20 hover:shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:p-7">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-shalean-soft-blue/70 text-shalean-primary">
                      <Icon className="h-6 w-6" aria-hidden />
                    </div>
                    <h3 className="mt-5 text-lg font-bold tracking-tight text-shalean-navy">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate-600">
                      {card.description}
                    </p>
                  </article>
                </li>
              );
            })}
          </ul>
        </MarketingContainer>
      </section>

      {/* How it works */}
      <section
        className={`${sectionRule} bg-shalean-surface ${sectionPad}`}
        aria-labelledby="about-how-heading"
      >
        <MarketingContainer>
          <SectionHeader
            eyebrow={ABOUT_PAGE_HOW_IT_WORKS.eyebrow}
            id="about-how-heading"
            title={ABOUT_PAGE_HOW_IT_WORKS.title}
            subtitle={ABOUT_PAGE_HOW_IT_WORKS.subtitle}
          />
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:mt-12 lg:grid-cols-5 lg:gap-5">
            {ABOUT_PAGE_HOW_IT_WORKS.steps.map((step, index) => {
              const Icon = STEP_ICONS[index] ?? IconCalendar;
              return (
                <li key={step.step} className="min-w-0">
                  <article className="relative flex h-full flex-col rounded-2xl border border-slate-200/90 bg-white p-6">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-shalean-primary">
                      Step {step.step}
                    </span>
                    <div className="mt-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-shalean-soft-blue to-blue-50/90">
                      <Icon className="h-6 w-6 text-shalean-primary" aria-hidden />
                    </div>
                    <h3 className="mt-4 font-bold tracking-tight text-shalean-navy">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                  </article>
                </li>
              );
            })}
          </ol>
        </MarketingContainer>
      </section>

      {/* Cape Town authority */}
      <section
        className={`${sectionRule} bg-white ${sectionPad}`}
        aria-labelledby="about-local-heading"
      >
        <MarketingContainer>
          <SectionHeader
            eyebrow={ABOUT_PAGE_LOCAL.eyebrow}
            id="about-local-heading"
            title={ABOUT_PAGE_LOCAL.title}
            subtitle={ABOUT_PAGE_LOCAL.subtitle}
          />
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-slate-600">
            {ABOUT_PAGE_LOCAL.audienceNote}
          </p>
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {ABOUT_PAGE_LOCAL.featuredAreas.map((area) => (
              <li key={area}>
                <Link
                  href={aboutAreaHref(area)}
                  className="marketing-focus-ring inline-flex rounded-full border border-slate-200/90 bg-shalean-surface px-4 py-2 text-sm font-medium text-shalean-navy transition hover:border-shalean-primary/30 hover:text-shalean-primary"
                >
                  {area}
                </Link>
              </li>
            ))}
          </ul>
          <nav
            className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold"
            aria-label="Cape Town cleaning resources"
          >
            <Link
              href={LOCATIONS_HUB_PATH}
              className="marketing-focus-ring text-shalean-primary hover:underline"
            >
              All service areas
            </Link>
            <Link
              href={SERVICES_HUB_PATH}
              className="marketing-focus-ring text-shalean-primary hover:underline"
            >
              Cleaning services
            </Link>
            <Link
              href={REVIEWS_PAGE_PATH}
              className="marketing-focus-ring text-shalean-primary hover:underline"
            >
              Customer reviews
            </Link>
          </nav>
        </MarketingContainer>
      </section>

      {/* Trust & safety */}
      <section
        className={`${sectionRule} bg-shalean-surface ${sectionPad}`}
        aria-labelledby="about-trust-heading"
      >
        <MarketingContainer>
          <SectionHeader
            eyebrow={ABOUT_PAGE_TRUST_SAFETY.eyebrow}
            id="about-trust-heading"
            title={ABOUT_PAGE_TRUST_SAFETY.title}
            subtitle={ABOUT_PAGE_TRUST_SAFETY.subtitle}
          />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:gap-6">
            {ABOUT_PAGE_TRUST_SAFETY.items.map((item) => {
              const Icon = TRUST_ICONS[item.id as keyof typeof TRUST_ICONS] ?? IconShield;
              return (
                <li key={item.id}>
                  <article className="flex gap-4 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-shalean-soft-blue/70 text-shalean-primary">
                      <Icon className="h-6 w-6" aria-hidden />
                    </div>
                    <div>
                      <h3 className="font-bold tracking-tight text-shalean-navy">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        {item.description}
                      </p>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </MarketingContainer>
      </section>

      {/* Social proof */}
      <section
        className={`${sectionRule} bg-white ${sectionPad}`}
        aria-labelledby="about-proof-heading"
      >
        <MarketingContainer>
          <SectionHeader
            eyebrow={ABOUT_PAGE_SOCIAL_PROOF.eyebrow}
            id="about-proof-heading"
            title={ABOUT_PAGE_SOCIAL_PROOF.title}
            subtitle={ABOUT_PAGE_SOCIAL_PROOF.subtitle}
          />
          <dl className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:mt-12">
            {ABOUT_PAGE_SOCIAL_PROOF.stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200/90 bg-shalean-surface px-6 py-5 text-center"
              >
                <dt className="text-2xl font-bold tracking-tight text-shalean-navy sm:text-3xl">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-sm text-slate-600">{stat.label}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ReviewStars rating={5} size="md" />
            <span className="text-sm font-semibold text-shalean-navy">
              {ABOUT_PAGE_SOCIAL_PROOF.ratingLabel}
            </span>
            <span className="text-sm text-slate-600">
              {ABOUT_PAGE_SOCIAL_PROOF.reviewCountLabel}
            </span>
            <a
              href={SHALEAN_CONTACT.googleReviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="marketing-focus-ring text-sm font-semibold text-shalean-primary hover:underline"
            >
              Read on Google
            </a>
          </div>
          <ul className="mt-10 grid gap-6 lg:grid-cols-2">
            {previewReviews.map((review) => (
              <li key={review.name}>
                <article className="h-full rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7">
                  <ReviewStars rating={review.rating} size="sm" />
                  <p className="mt-4 text-[0.9375rem] leading-relaxed text-slate-600">
                    &ldquo;{review.text}&rdquo;
                  </p>
                  <footer className="mt-4 text-sm">
                    <p className="font-semibold text-shalean-navy">{review.name}</p>
                    <p className="text-slate-500">
                      {review.suburb}, Cape Town · {review.context}
                    </p>
                  </footer>
                </article>
              </li>
            ))}
          </ul>
          <Link
            href={REVIEWS_PAGE_PATH}
            className="marketing-focus-ring mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-shalean-primary hover:underline"
          >
            Read all customer reviews
            <IconArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </MarketingContainer>
      </section>

      {/* Who we serve */}
      <section
        className={`${sectionRule} bg-shalean-surface ${sectionPad}`}
        aria-labelledby="about-serve-heading"
      >
        <MarketingContainer>
          <SectionHeader
            eyebrow={ABOUT_PAGE_WHO_WE_SERVE.eyebrow}
            id="about-serve-heading"
            title={ABOUT_PAGE_WHO_WE_SERVE.title}
          />
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-6">
            {ABOUT_PAGE_WHO_WE_SERVE.cards.map((card) => {
              const Icon = SERVE_ICONS[card.id as keyof typeof SERVE_ICONS] ?? IconHome;
              return (
                <li key={card.id}>
                  <article className="h-full rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-7">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-shalean-soft-blue/60 text-shalean-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <h3 className="mt-4 font-bold tracking-tight text-shalean-navy">{card.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.description}</p>
                  </article>
                </li>
              );
            })}
          </ul>
        </MarketingContainer>
      </section>

      {/* Careers */}
      <section
        className={`${sectionRule} bg-white ${sectionPad}`}
        aria-labelledby="about-careers-heading"
      >
        <MarketingContainer>
          <div className="grid items-center gap-10 rounded-3xl border border-slate-200/90 bg-gradient-to-br from-shalean-surface to-white p-8 sm:p-10 lg:grid-cols-[minmax(0,1.2fr)_auto] lg:gap-12 lg:p-12">
            <div>
              <SectionEyebrow className="tracking-[0.12em] text-shalean-primary">
                {ABOUT_PAGE_CAREERS.eyebrow}
              </SectionEyebrow>
              <h2
                id="about-careers-heading"
                className="mt-4 text-2xl font-bold tracking-tight text-shalean-navy sm:text-3xl"
              >
                {ABOUT_PAGE_CAREERS.title}
              </h2>
              <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-600">
                {ABOUT_PAGE_CAREERS.paragraphs.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
            </div>
            <MarketingButton
              href={ABOUT_PAGE_CAREERS.ctaHref}
              className="!rounded-2xl !px-8 lg:justify-self-end"
              aria-label={ABOUT_PAGE_CAREERS.ctaLabel}
            >
              {ABOUT_PAGE_CAREERS.ctaLabel}
            </MarketingButton>
          </div>
        </MarketingContainer>
      </section>

      {/* FAQ */}
      <section
        className={`${sectionRule} bg-shalean-surface ${sectionPad}`}
        aria-labelledby="about-faq-heading"
      >
        <MarketingContainer>
          <SectionHeader
            eyebrow="FAQs"
            id="about-faq-heading"
            title="About Shalean — common questions"
            subtitle="Platform, operations, recurring cleaning, and Cape Town coverage."
          />
          <div className="mx-auto mt-10 max-w-3xl">
            <FaqAccordion items={ABOUT_PAGE_FAQ} />
          </div>
        </MarketingContainer>
      </section>

      {/* Final CTA */}
      <section
        className={`${sectionRule} border-b border-slate-200/70 bg-shalean-navy py-14 text-white sm:py-16 lg:py-20`}
        aria-labelledby="about-final-cta-heading"
      >
        <MarketingContainer className="text-center">
          <h2
            id="about-final-cta-heading"
            className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-[2rem]"
          >
            {ABOUT_PAGE_FINAL_CTA.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            {ABOUT_PAGE_FINAL_CTA.subtitle}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={ABOUT_PAGE_FINAL_CTA.book.href}
              className="marketing-focus-ring inline-flex items-center gap-2 rounded-xl bg-shalean-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
            >
              {ABOUT_PAGE_FINAL_CTA.book.label}
              <IconArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href={ABOUT_PAGE_FINAL_CTA.pricing.href}
              className="marketing-focus-ring inline-flex items-center gap-2 rounded-xl border-2 border-white/25 px-6 py-3 text-sm font-bold text-white transition hover:border-white/50 hover:bg-white/10"
            >
              {ABOUT_PAGE_FINAL_CTA.pricing.label}
            </Link>
            <Link
              href={ABOUT_PAGE_FINAL_CTA.services.href}
              className="marketing-focus-ring inline-flex items-center gap-2 rounded-xl border-2 border-white/25 px-6 py-3 text-sm font-bold text-white transition hover:border-white/50 hover:bg-white/10"
            >
              {ABOUT_PAGE_FINAL_CTA.services.label}
            </Link>
          </div>
        </MarketingContainer>
      </section>

      <MarketingContainer className="pb-8">
        <MarketingInternalLinks showAbout={false} showReviews showServicesHub />
      </MarketingContainer>
    </>
  );
}
