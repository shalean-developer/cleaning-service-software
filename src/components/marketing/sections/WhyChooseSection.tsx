import { WHY_CHOOSE } from "@/features/marketing/constants";
import { IconCalendar, IconLeaf, IconShield, IconSparkle } from "../icons";
import { MarketingContainer } from "../MarketingContainer";
import { SectionEyebrow } from "../SectionEyebrow";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

const featureIcons: Record<string, typeof IconShield> = {
  vetted: IconShield,
  insured: IconShield,
  eco: IconLeaf,
  payments: IconSparkle,
  flexible: IconCalendar,
  guarantee: IconSparkle,
};

export function WhyChooseSection() {
  return (
    <section
      id="about"
      className="marketing-section !pt-8 bg-white lg:!pt-10"
      aria-labelledby="why-choose-heading"
    >
      <MarketingContainer>
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)] lg:items-stretch lg:gap-16">
          <div className="flex h-full flex-col">
            <SectionEyebrow>Why Choose Shalean?</SectionEyebrow>
            <h2
              id="why-choose-heading"
              className="mt-3 text-3xl font-bold tracking-tight text-shalean-navy md:text-4xl"
            >
              Trusted by Thousands of Happy Customers
            </h2>

            <ul className="mt-10 grid flex-1 grid-cols-2 content-start gap-7 sm:grid-cols-3">
              {WHY_CHOOSE.map((item) => {
                const Icon = featureIcons[item.id] ?? IconShield;
                return (
                  <li key={item.id} className="flex flex-col items-center text-center sm:items-start sm:text-left">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-shalean-soft-blue text-shalean-primary sm:h-11 sm:w-11">
                      <Icon className="h-5 w-5 sm:h-[1.125rem] sm:w-[1.125rem]" />
                    </span>
                    <h3 className="mt-3 text-sm font-bold text-shalean-navy sm:text-[0.9375rem]">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-slate-600 sm:text-sm">
                      {item.description}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="w-full lg:flex lg:min-h-0 lg:h-full">
            <BeforeAfterSlider fillHeight className="w-full max-lg:max-w-[45rem] lg:h-full" />
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}
