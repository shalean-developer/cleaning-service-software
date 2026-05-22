import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Building2,
  CalendarDays,
  Check,
  Home,
  KeyRound,
  Shield,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { MarketingButton } from "@/components/marketing/MarketingButton";
import { MarketingContainer } from "@/components/marketing/MarketingContainer";
import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { IconArrowRight } from "@/components/marketing/icons";
import {
  APPLY_HERO,
  APPLY_PAGE_FAQ,
  APPLY_PAGE_H1,
  APPLY_PROCESS_NOTE,
  APPLY_PROCESS_STEPS,
  APPLY_REQUIREMENTS,
  APPLY_REQUIREMENTS_NOTE,
  APPLY_TRUST_STRIP,
  APPLY_WORK_TYPE_CARDS,
} from "@/features/marketing/apply-page-content";
import { APPLY_LANDING_CTA } from "@/features/marketing/apply-page-content";

const sectionPad = "py-16 sm:py-20 lg:py-24";
const sectionBorder = "border-t border-slate-200/70";

const WORK_ICONS: Record<(typeof APPLY_WORK_TYPE_CARDS)[number]["icon"], LucideIcon> = {
  home: Home,
  sparkles: Sparkles,
  key: KeyRound,
  building: Building2,
  calendar: CalendarDays,
};

type ApplyPageSectionsProps = {
  heroAfterBreadcrumbs?: ReactNode;
};

export function ApplyPageSections({ heroAfterBreadcrumbs }: ApplyPageSectionsProps) {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-white pb-12 pt-8 sm:pb-16 sm:pt-10">
        <div
          className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-shalean-primary/[0.04] blur-3xl"
          aria-hidden
        />
        <MarketingContainer>
          {heroAfterBreadcrumbs}
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <SectionEyebrow>Cleaner opportunities in Cape Town</SectionEyebrow>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-shalean-navy sm:text-4xl lg:text-[2.75rem] lg:leading-[1.12]">
                {APPLY_PAGE_H1}
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
                {APPLY_HERO.subtitle}
              </p>
              <ul className="mt-6 space-y-2.5">
                {APPLY_HERO.benefits.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 sm:text-base">
                    <Check
                      className="mt-0.5 h-5 w-5 shrink-0 text-shalean-primary"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <MarketingButton href={APPLY_HERO.primaryHref}>
                  {APPLY_HERO.primaryCta}
                </MarketingButton>
                <Link
                  href={APPLY_HERO.secondaryHref}
                  className="marketing-focus-ring inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300"
                >
                  {APPLY_HERO.secondaryCta}
                  <IconArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
              <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-shalean-primary/10 to-transparent" />
              <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 shadow-[0_20px_50px_rgba(15,23,42,0.12)]">
                <Image
                  src={APPLY_HERO.image}
                  alt={APPLY_HERO.imageAlt}
                  width={640}
                  height={480}
                  className="h-auto w-full object-cover"
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            </div>
          </div>
          <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {APPLY_TRUST_STRIP.map((label) => (
              <li
                key={label}
                className="rounded-xl border border-slate-200/80 bg-white px-4 py-3 text-center text-xs font-medium text-slate-600 shadow-sm sm:text-sm"
              >
                {label}
              </li>
            ))}
          </ul>
        </MarketingContainer>
      </section>

      {/* Work types */}
      <section className={`${sectionBorder} ${sectionPad} bg-slate-50/40`}>
        <MarketingContainer>
          <div className="max-w-2xl">
            <SectionEyebrow>Work with Shalean</SectionEyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-shalean-navy sm:text-3xl">
              Types of cleaning work available
            </h2>
            <p className="mt-3 text-base text-slate-600">
              Opportunities depend on your preferences, areas, and availability — we do not
              guarantee a fixed volume of jobs.
            </p>
          </div>
          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {APPLY_WORK_TYPE_CARDS.map((card) => {
              const Icon = WORK_ICONS[card.icon];
              return (
                <li
                  key={card.id}
                  className="group flex flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:border-shalean-primary/25 hover:shadow-md"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-shalean-primary/10 text-shalean-primary">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-shalean-navy">{card.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                    {card.description}
                  </p>
                  <ul className="mt-4 space-y-1 text-sm text-slate-500">
                    {card.tasks.map((t) => (
                      <li key={t}>· {t}</li>
                    ))}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </MarketingContainer>
      </section>

      {/* How it works */}
      <section className={`${sectionBorder} ${sectionPad}`}>
        <MarketingContainer>
          <div className="max-w-2xl">
            <SectionEyebrow>How it works</SectionEyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-shalean-navy sm:text-3xl">
              From application to your first offers
            </h2>
          </div>
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {APPLY_PROCESS_STEPS.map((item) => (
              <li
                key={item.step}
                className="relative rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-shalean-primary text-sm font-bold text-white">
                  {item.step}
                </span>
                <h3 className="mt-4 font-semibold text-shalean-navy">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 max-w-3xl rounded-xl border border-amber-200/80 bg-amber-50/60 px-5 py-4 text-sm text-amber-950">
            <strong className="font-semibold">Important:</strong> {APPLY_PROCESS_NOTE}
          </p>
        </MarketingContainer>
      </section>

      {/* Requirements */}
      <section className={`${sectionBorder} ${sectionPad} bg-slate-50/40`}>
        <MarketingContainer>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <SectionEyebrow>Requirements</SectionEyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-shalean-navy sm:text-3xl">
                What we look for
              </h2>
              <p className="mt-3 text-sm text-slate-600">{APPLY_REQUIREMENTS_NOTE}</p>
            </div>
            <ul className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
              {APPLY_REQUIREMENTS.map((req) => (
                <li key={req} className="flex gap-3 text-sm text-slate-700 sm:text-base">
                  <Shield className="mt-0.5 h-5 w-5 shrink-0 text-shalean-primary" aria-hidden />
                  {req}
                </li>
              ))}
              <li className="flex gap-3 border-t border-slate-100 pt-4 text-sm text-slate-500">
                <Smartphone className="h-5 w-5 shrink-0" aria-hidden />
                <Users className="h-5 w-5 shrink-0 -ml-3 opacity-0" aria-hidden />
                No ID upload, banking details, or sensitive documents on this form.
              </li>
            </ul>
          </div>
        </MarketingContainer>
      </section>

      {/* Apply CTA */}
      <section className={`${sectionBorder} ${sectionPad}`}>
        <MarketingContainer>
          <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/80 bg-gradient-to-br from-shalean-primary/[0.06] to-white p-8 text-center shadow-sm sm:p-10">
            <SectionEyebrow>{APPLY_LANDING_CTA.eyebrow}</SectionEyebrow>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-shalean-navy sm:text-3xl">
              {APPLY_LANDING_CTA.title}
            </h2>
            <p className="mt-3 text-base text-slate-600">{APPLY_LANDING_CTA.subtitle}</p>
            <div className="mt-8">
              <MarketingButton href={APPLY_LANDING_CTA.href}>
                {APPLY_LANDING_CTA.label}
              </MarketingButton>
            </div>
          </div>
        </MarketingContainer>
      </section>

      {/* FAQ */}
      <section className={`${sectionBorder} ${sectionPad} bg-slate-50/40`}>
        <MarketingContainer>
          <div className="mx-auto max-w-2xl">
            <SectionEyebrow>FAQ</SectionEyebrow>
            <h2 className="mt-3 text-2xl font-semibold text-shalean-navy">Common questions</h2>
            <div className="mt-8">
              <FaqAccordion items={[...APPLY_PAGE_FAQ]} />
            </div>
          </div>
        </MarketingContainer>
      </section>
    </>
  );
}
