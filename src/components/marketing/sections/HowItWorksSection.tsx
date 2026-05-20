import { Fragment, type CSSProperties } from "react";
import { HOW_IT_WORKS, HOW_IT_WORKS_SECTION } from "@/features/marketing/constants";
import { IconCalendar, IconHome, IconSparkle, IconUser } from "../icons";
import { MarketingContainer } from "../MarketingContainer";
import { SectionEyebrow } from "../SectionEyebrow";

const STEP_ICONS = [IconCalendar, IconUser, IconSparkle, IconHome] as const;

function StepConnector({ className = "" }: { className?: string }) {
  return (
    <li
      className={`list-none ${className}`.trim()}
      aria-hidden
    >
      <span className="how-it-works-connector block h-px w-full border-t border-dashed border-shalean-primary/25" />
    </li>
  );
}

type HowItWorksStepProps = {
  step: (typeof HOW_IT_WORKS)[number];
  index: number;
  layout: "timeline" | "grid" | "row";
};

function HowItWorksStep({ step, index, layout }: HowItWorksStepProps) {
  const Icon = STEP_ICONS[index] ?? IconCalendar;
  const isTimeline = layout === "timeline";

  return (
    <div
      className={`how-it-works-step group relative flex min-w-0 flex-col ${
        isTimeline
          ? "items-start pl-0 text-left sm:items-center sm:text-center"
          : "items-center text-center"
      }`}
      style={{ "--step-index": index } as CSSProperties}
    >
      {isTimeline ? (
        <span
          className="absolute -left-[2.125rem] top-5 flex h-3 w-3 rounded-full border-2 border-white bg-shalean-primary ring-2 ring-shalean-soft-blue sm:hidden"
          aria-hidden
        />
      ) : null}

      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-shalean-soft-blue to-blue-50/90 transition duration-300 ease-out group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_28px_rgba(37,99,235,0.12)] sm:h-[3.75rem] sm:w-[3.75rem] ${
          isTimeline ? "sm:mx-auto" : ""
        }`}
      >
        <Icon className="h-6 w-6 text-shalean-primary transition-transform duration-300 group-hover:scale-105 sm:h-7 sm:w-7" />
      </div>

      <span
        className={`mt-5 inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full bg-shalean-primary px-2.5 text-xs font-bold tracking-wide text-white ${
          isTimeline ? "sm:mx-auto" : ""
        }`}
      >
        {step.step}
      </span>

      <h3
        className={`mt-3 text-lg font-semibold tracking-tight text-shalean-navy sm:text-xl ${
          isTimeline ? "sm:mx-auto" : ""
        }`}
      >
        {step.title}
      </h3>
      <p
        className={`mt-2 max-w-[16rem] text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem] ${
          isTimeline ? "sm:mx-auto" : ""
        }`}
      >
        {step.description}
      </p>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="marketing-section relative bg-white"
      aria-labelledby="how-it-works-heading"
    >
      <MarketingContainer>
        <header className="mx-auto max-w-3xl text-center">
          <SectionEyebrow className="tracking-[0.14em] text-shalean-primary">
            {HOW_IT_WORKS_SECTION.eyebrow}
          </SectionEyebrow>
          <h2
            id="how-it-works-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-shalean-navy sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]"
          >
            {HOW_IT_WORKS_SECTION.heading}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg">
            {HOW_IT_WORKS_SECTION.subtitle}
          </p>
        </header>

        {/* Mobile: vertical timeline */}
        <ol className="how-it-works-timeline relative mt-12 space-y-12 pl-8 sm:hidden">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.step}>
              <HowItWorksStep step={step} index={index} layout="timeline" />
            </li>
          ))}
        </ol>

        {/* Tablet: 2×2 grid */}
        <ol className="mt-14 hidden auto-rows-fr grid-cols-2 gap-x-10 gap-y-14 sm:grid lg:hidden">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.step} className="min-w-0">
              <HowItWorksStep step={step} index={index} layout="grid" />
            </li>
          ))}
        </ol>

        {/* Desktop: horizontal flow with connectors */}
        <ol className="mt-16 hidden list-none items-start lg:flex lg:gap-0">
          {HOW_IT_WORKS.map((step, index) => (
            <Fragment key={step.step}>
              <li className="flex min-w-0 flex-1 flex-col">
                <HowItWorksStep step={step} index={index} layout="row" />
              </li>
              {index < HOW_IT_WORKS.length - 1 ? (
                <StepConnector className="flex w-10 shrink-0 items-center self-start px-1 pt-7 xl:w-14 xl:px-2" />
              ) : null}
            </Fragment>
          ))}
        </ol>
      </MarketingContainer>
    </section>
  );
}
