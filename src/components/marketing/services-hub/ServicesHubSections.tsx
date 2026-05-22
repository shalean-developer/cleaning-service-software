import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ServicesHubExploreByAreaSection } from "@/components/marketing/ServicesHubExploreByAreaSection";
import { MarketingButton } from "@/components/marketing/MarketingButton";
import { MarketingContainer } from "@/components/marketing/MarketingContainer";
import { MarketingInternalLinks } from "@/components/marketing/MarketingInternalLinks";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { ServiceCardIcon } from "@/components/marketing/ServiceCardIcon";
import {
  IconArrowRight,
  IconCalendar,
  IconCreditCard,
  IconMapPin,
  IconShield,
  IconSparkle,
} from "@/components/marketing/icons";
import {
  areaLocationPath,
  MARKETING_SERVICES,
  SERVICE_SEO_PATHS,
  serviceFromPrice,
} from "@/features/marketing/constants";
import {
  SERVICES_HUB_BENEFITS,
  SERVICES_HUB_ECOSYSTEM,
  SERVICES_HUB_HERO,
  SERVICES_HUB_FINAL_CTA,
  SERVICES_HUB_POPULAR,
  SERVICES_HUB_RECURRING,
  SERVICES_HUB_USE_CASES,
  type ServicesHubOfferingCard,
} from "@/features/marketing/services-hub-content";
import {
  FAQ_PAGE_PATH,
  LOCATIONS_HUB_PATH,
  PRICING_PAGE_PATH,
  SERVICES_HUB_FAQ_PREVIEW,
} from "@/features/marketing/seo-pages";

const sectionRule = "border-t border-slate-200/70";
const sectionPad = "py-14 sm:py-16 lg:py-20";

const BENEFIT_ICONS = {
  vetted: IconShield,
  payments: IconCreditCard,
  scheduling: IconCalendar,
  coverage: IconMapPin,
} as const;

function HubSectionHeader({
  eyebrow,
  title,
  subtitle,
  id,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  id: string;
}) {
  return (
    <header className="max-w-3xl">
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

function OfferingCard({ card }: { card: ServicesHubOfferingCard }) {
  const muted = card.comingSoon === true;

  return (
    <li className="min-w-0">
      <article
        className={`group flex h-full flex-col rounded-2xl border bg-white p-6 transition duration-200 sm:p-7 ${
          muted
            ? "border-slate-100 bg-slate-50/80 opacity-75"
            : "border-slate-200/90 hover:border-shalean-primary/25 hover:shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
        }`}
      >
        <div className="flex items-start justify-between gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
              muted ? "bg-slate-100 text-slate-400" : "bg-shalean-soft-blue/70 text-shalean-primary"
            }`}
          >
            {card.iconSlug ? (
              <ServiceCardIcon slug={card.iconSlug} className="h-6 w-6" />
            ) : (
              <IconSparkle className="h-6 w-6" aria-hidden />
            )}
          </div>
          {muted ? (
            <span className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-500">
              Coming soon
            </span>
          ) : null}
        </div>

        <h3 className="mt-5 text-lg font-bold tracking-tight text-shalean-navy">{card.title}</h3>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate-600">{card.description}</p>
        <p className="mt-3 text-sm font-medium text-shalean-primary/90">{card.benefit}</p>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-6">
          {muted ? (
            <span className="text-sm font-semibold text-slate-400">{card.ctaLabel}</span>
          ) : (
            <>
              {card.href ? (
                <Link
                  href={card.href}
                  className="marketing-focus-ring inline-flex items-center gap-1.5 text-sm font-semibold text-shalean-primary hover:underline"
                  aria-label={card.ctaLabel}
                >
                  {card.ctaLabel}
                  <IconArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
              {card.bookHref ? (
                <Link
                  href={card.bookHref}
                  className="marketing-focus-ring text-sm font-medium text-slate-500 hover:text-shalean-navy"
                  aria-label={`Book ${card.title} online`}
                >
                  Book now
                </Link>
              ) : null}
            </>
          )}
        </div>
      </article>
    </li>
  );
}

function PopularServiceCard({
  slug,
  bestFor,
  duration,
  ctaLabel,
}: (typeof SERVICES_HUB_POPULAR)[number]) {
  const service = MARKETING_SERVICES.find((s) => s.slug === slug)!;
  const fromPrice = serviceFromPrice(slug);
  const href = SERVICE_SEO_PATHS[slug];

  return (
    <li className="min-w-0">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
        <div className="relative aspect-[16/10] w-full shrink-0 bg-slate-100">
          <Image
            src={service.image}
            alt={service.imageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        </div>
        <div className="flex flex-1 flex-col p-6 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-shalean-primary">
            Most popular
          </p>
          <h3 className="mt-2 text-xl font-bold tracking-tight text-shalean-navy">
            {service.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
            {service.cardTagline}
          </p>
          <dl className="mt-4 space-y-2.5 text-sm text-slate-600">
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-shalean-navy">Best for</dt>
              <dd>{bestFor}</dd>
            </div>
            <div className="flex flex-wrap gap-x-2">
              <dt className="font-semibold text-shalean-navy">Duration</dt>
              <dd>{duration}</dd>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <dt className="font-semibold text-shalean-navy">From</dt>
              <dd className="font-bold text-shalean-primary">{fromPrice}</dd>
            </div>
          </dl>
          <div className="mt-auto pt-6">
            <Link
              href={href}
              className="marketing-focus-ring inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-shalean-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 sm:w-auto"
              aria-label={ctaLabel}
            >
              {ctaLabel}
              <IconArrowRight className="h-4 w-4 shrink-0" aria-hidden />
            </Link>
          </div>
        </div>
      </article>
    </li>
  );
}

function UseCaseBlock({
  useCase,
  reverse,
}: {
  useCase: (typeof SERVICES_HUB_USE_CASES)[number];
  reverse?: boolean;
}) {
  return (
    <article
      className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${reverse ? "lg:[&>div:first-child]:order-2" : ""}`}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-slate-100">
        <Image
          src={useCase.image}
          alt={useCase.imageAlt}
          fill
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      </div>
      <div>
        <h3 className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl">
          {useCase.title}
        </h3>
        <p className="mt-4 text-base leading-relaxed text-slate-600">{useCase.intro}</p>
        <ul className="mt-6 flex flex-col gap-2.5">
          {useCase.links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="marketing-focus-ring inline-flex items-center gap-1.5 text-sm font-semibold text-shalean-primary hover:underline"
              >
                {link.label}
                <IconArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

type ServicesHubSectionsProps = {
  heroAfterBreadcrumbs?: ReactNode;
};

export function ServicesHubSections({ heroAfterBreadcrumbs }: ServicesHubSectionsProps) {
  return (
    <>
      {/* Hero */}
      <section
        className="relative overflow-hidden bg-gradient-to-b from-white via-white to-shalean-surface"
        aria-labelledby="services-hub-hero-heading"
      >
        <MarketingContainer className="py-10 sm:py-14 lg:py-16">
          {heroAfterBreadcrumbs}
          <div className="mx-auto max-w-3xl lg:mx-0 lg:max-w-[40rem]">
            <SectionEyebrow className="tracking-[0.12em] text-shalean-primary">
              {SERVICES_HUB_HERO.eyebrow}
            </SectionEyebrow>
            <h1
              id="services-hub-hero-heading"
              className="mt-4 text-[2rem] font-extrabold leading-[1.1] tracking-[-0.02em] text-shalean-navy sm:text-4xl lg:text-[2.75rem]"
            >
              {SERVICES_HUB_HERO.h1}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg sm:leading-[1.65]">
              {SERVICES_HUB_HERO.intro}
            </p>
            <p className="mt-5 text-sm font-medium tracking-wide text-slate-500">
              {SERVICES_HUB_HERO.trustLine}
            </p>
            <div className="mt-8 flex flex-wrap gap-3 sm:mt-10">
              <MarketingButton
                href={SERVICES_HUB_FINAL_CTA.book.href}
                className="!rounded-2xl !px-7"
                aria-label="Book a cleaning service in Cape Town"
              >
                Book a cleaning
              </MarketingButton>
              <MarketingButton
                href={PRICING_PAGE_PATH}
                variant="secondary"
                className="!rounded-2xl !px-7"
                aria-label="Explore cleaning prices in Cape Town"
              >
                Explore prices
              </MarketingButton>
            </div>
          </div>
        </MarketingContainer>
      </section>

      {/* Ecosystem grid */}
      <section className={`${sectionRule} bg-white ${sectionPad}`} aria-labelledby="ecosystem-heading">
        <MarketingContainer>
          <HubSectionHeader
            eyebrow="Service directory"
            id="ecosystem-heading"
            title="Cleaning services for every home and business"
            subtitle="Browse Shalean's full Cape Town offering — from everyday home care to specialized commercial and host services."
          />
          <ul className="mt-10 grid auto-rows-fr grid-cols-1 gap-5 sm:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-6">
            {SERVICES_HUB_ECOSYSTEM.map((card) => (
              <OfferingCard key={card.id} card={card} />
            ))}
          </ul>
        </MarketingContainer>
      </section>

      {/* Popular */}
      <section
        className={`${sectionRule} bg-shalean-surface ${sectionPad}`}
        aria-labelledby="popular-heading"
      >
        <MarketingContainer>
          <HubSectionHeader
            id="popular-heading"
            title="Most popular cleaning options"
            subtitle="High-conversion services Cape Town customers book most often."
          />
          <ul className="mt-10 grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2 lg:mt-12 lg:grid-cols-3 lg:gap-7">
            {SERVICES_HUB_POPULAR.map((item) => (
              <PopularServiceCard key={item.slug} {...item} />
            ))}
          </ul>
        </MarketingContainer>
      </section>

      {/* Benefits strip */}
      <section
        className={`${sectionRule} bg-white py-10 sm:py-12`}
        aria-labelledby="benefits-heading"
      >
        <MarketingContainer>
          <h2 id="benefits-heading" className="sr-only">
            Why book with Shalean
          </h2>
          <ul className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            {SERVICES_HUB_BENEFITS.map((item) => {
              const Icon = BENEFIT_ICONS[item.id as keyof typeof BENEFIT_ICONS] ?? IconShield;
              return (
                <li key={item.id} className="text-center sm:text-left">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-shalean-soft-blue/60 text-shalean-primary sm:mx-0">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-shalean-navy">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </li>
              );
            })}
          </ul>
        </MarketingContainer>
      </section>

      {/* Use cases */}
      <section className={`${sectionRule} ${sectionPad}`} aria-labelledby="use-cases-heading">
        <MarketingContainer>
          <HubSectionHeader
            eyebrow="By customer type"
            id="use-cases-heading"
            title="Find the right cleaning for your situation"
            subtitle="Segmented guidance for homeowners, hosts, businesses, and specialized needs."
          />
          <div className="mt-12 space-y-16 lg:mt-16 lg:space-y-20">
            {SERVICES_HUB_USE_CASES.map((useCase, index) => (
              <UseCaseBlock key={useCase.id} useCase={useCase} reverse={index % 2 === 1} />
            ))}
          </div>
        </MarketingContainer>
      </section>

      {/* Recurring */}
      <section
        className={`${sectionRule} bg-shalean-soft-blue/30 ${sectionPad}`}
        aria-labelledby="recurring-heading"
      >
        <MarketingContainer>
          <div className="mx-auto max-w-3xl lg:mx-0">
            <HubSectionHeader
              eyebrow="Repeat visits"
              id="recurring-heading"
              title={SERVICES_HUB_RECURRING.title}
            />
            {SERVICES_HUB_RECURRING.paragraphs.map((paragraph) => (
              <p
                key={paragraph.slice(0, 24)}
                className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg"
              >
                {paragraph}
              </p>
            ))}
            <ul className="mt-6 flex flex-wrap gap-2 text-sm font-medium text-shalean-navy">
              {["Weekly", "Bi-weekly", "Monthly", "Multi-day schedules"].map((label) => (
                <li
                  key={label}
                  className="rounded-full border border-shalean-primary/20 bg-white px-3.5 py-1.5"
                >
                  {label}
                </li>
              ))}
            </ul>
            <p className="mt-8">
              <Link
                href={SERVICES_HUB_RECURRING.ctaHref}
                className="marketing-focus-ring inline-flex items-center gap-1.5 text-sm font-semibold text-shalean-primary hover:underline"
                aria-label={SERVICES_HUB_RECURRING.ctaLabel}
              >
                {SERVICES_HUB_RECURRING.ctaLabel}
                <IconArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </p>
          </div>
        </MarketingContainer>
      </section>

      {/* Locations */}
      <section
        className={`${sectionRule} bg-white ${sectionPad}`}
        aria-labelledby="locations-heading"
      >
        <MarketingContainer>
          <HubSectionHeader
            id="locations-heading"
            title="Explore by area"
            subtitle="Suburb pages with local service detail — without leaving the services directory."
          />
          <ServicesHubExploreByAreaSection compact />
        </MarketingContainer>
      </section>

      {/* FAQ */}
      <section className={`${sectionRule} ${sectionPad}`} aria-labelledby="faq-heading">
        <MarketingContainer>
          <HubSectionHeader
            eyebrow="Guides & answers"
            id="faq-heading"
            title="Cleaning service guides"
            subtitle="Authority-focused answers with links to pricing, FAQs, and individual service pages."
          />
          <dl className="mt-10 max-w-3xl space-y-8">
            {SERVICES_HUB_FAQ_PREVIEW.map((item) => (
              <div key={item.question}>
                <dt className="text-lg font-bold text-shalean-navy">{item.question}</dt>
                <dd className="mt-2 text-base leading-relaxed text-slate-600">{item.answer}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <Link
              href={PRICING_PAGE_PATH}
              className="marketing-focus-ring text-shalean-primary hover:underline"
            >
              Cape Town cleaning prices
            </Link>
            <Link
              href={FAQ_PAGE_PATH}
              className="marketing-focus-ring text-shalean-primary hover:underline"
            >
              Full cleaning FAQs
            </Link>
            <Link
              href={LOCATIONS_HUB_PATH}
              className="marketing-focus-ring text-shalean-primary hover:underline"
            >
              Service areas
            </Link>
          </div>
        </MarketingContainer>
      </section>

      {/* Final CTA band */}
      <section
        className={`${sectionRule} border-b border-slate-200/70 bg-shalean-navy py-14 text-white sm:py-16 lg:py-20`}
        aria-labelledby="final-cta-heading"
      >
        <MarketingContainer>
          <h2 id="final-cta-heading" className="sr-only">
            Get started with Shalean
          </h2>
          <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
            <article className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
              <h3 className="text-xl font-bold tracking-tight sm:text-2xl">
                {SERVICES_HUB_FINAL_CTA.book.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                {SERVICES_HUB_FINAL_CTA.book.description}
              </p>
              <Link
                href={SERVICES_HUB_FINAL_CTA.book.href}
                className="marketing-focus-ring mt-6 inline-flex items-center gap-2 rounded-xl bg-shalean-primary px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
                aria-label={SERVICES_HUB_FINAL_CTA.book.label}
              >
                {SERVICES_HUB_FINAL_CTA.book.label}
                <IconArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
              <h3 className="text-xl font-bold tracking-tight sm:text-2xl">
                {SERVICES_HUB_FINAL_CTA.apply.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                {SERVICES_HUB_FINAL_CTA.apply.description}
              </p>
              <Link
                href={SERVICES_HUB_FINAL_CTA.apply.href}
                className="marketing-focus-ring mt-6 inline-flex items-center gap-2 rounded-xl border-2 border-white/25 bg-transparent px-6 py-3 text-sm font-bold text-white transition hover:border-white/50 hover:bg-white/10"
                aria-label={SERVICES_HUB_FINAL_CTA.apply.label}
              >
                {SERVICES_HUB_FINAL_CTA.apply.label}
                <IconArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </article>
          </div>
        </MarketingContainer>
      </section>

      <MarketingContainer className="pb-8">
        <MarketingInternalLinks
          showServicesHub={false}
          servicePaths={Object.values(SERVICE_SEO_PATHS)}
        />
      </MarketingContainer>
    </>
  );
}
