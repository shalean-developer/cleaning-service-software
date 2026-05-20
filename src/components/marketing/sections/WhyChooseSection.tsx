import type { CSSProperties } from "react";
import { WHY_CHOOSE, WHY_CHOOSE_SECTION } from "@/features/marketing/constants";
import {
  IconCalendar,
  IconCreditCard,
  IconLeaf,
  IconLock,
  IconShield,
  IconSparkle,
} from "../icons";
import { MarketingContainer } from "../MarketingContainer";
import { SectionEyebrow } from "../SectionEyebrow";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

const FEATURE_ICONS = {
  vetted: IconShield,
  insured: IconLock,
  eco: IconLeaf,
  payments: IconCreditCard,
  flexible: IconCalendar,
  guarantee: IconSparkle,
} as const;

type TrustFeatureProps = {
  item: (typeof WHY_CHOOSE)[number];
  index: number;
};

function TrustFeatureCard({ item, index }: TrustFeatureProps) {
  const Icon = FEATURE_ICONS[item.id] ?? IconShield;

  return (
    <li
      className="why-choose-feature group marketing-card-hover min-w-0 rounded-[1.25rem] border border-slate-200/90 bg-white p-5 sm:rounded-3xl sm:p-6"
      style={{ "--feature-index": index } as CSSProperties}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-shalean-soft-blue to-blue-50/90 transition duration-300 group-hover:shadow-[0_8px_24px_rgba(37,99,235,0.1)]">
        <Icon className="h-5 w-5 text-shalean-primary" />
      </div>
      <h3 className="mt-4 text-base font-semibold tracking-tight text-shalean-navy">
        {item.title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
    </li>
  );
}

export function WhyChooseSection() {
  return (
    <section
      id="about"
      className="marketing-section relative bg-shalean-surface"
      aria-labelledby="why-choose-heading"
    >
      <MarketingContainer>
        <header className="mx-auto max-w-3xl text-center lg:mx-0 lg:max-w-xl lg:text-left">
          <SectionEyebrow className="tracking-[0.14em] text-shalean-primary">
            {WHY_CHOOSE_SECTION.eyebrow}
          </SectionEyebrow>
          <h2
            id="why-choose-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-shalean-navy sm:text-4xl lg:text-[2.5rem] lg:leading-[1.12]"
          >
            {WHY_CHOOSE_SECTION.heading}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
            {WHY_CHOOSE_SECTION.subtitle}
          </p>
        </header>

        <div className="mt-12 grid items-start gap-10 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-12 xl:gap-16">
          {/* Mobile: showcase first for visibility */}
          <div className="order-1 min-w-0 lg:order-2 lg:sticky lg:top-28">
            <BeforeAfterSlider fillHeight className="w-full" />
          </div>

          <div className="order-2 min-w-0 lg:order-1">
            <ul className="grid grid-cols-2 gap-4 sm:gap-5 lg:gap-5">
              {WHY_CHOOSE.map((item, index) => (
                <TrustFeatureCard key={item.id} item={item} index={index} />
              ))}
            </ul>
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}
