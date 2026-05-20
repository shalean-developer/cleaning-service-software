import { HOW_IT_WORKS } from "@/features/marketing/constants";
import { IconCalendar, IconSparkle, IconUser } from "../icons";
import { MarketingContainer } from "../MarketingContainer";
import { SectionEyebrow } from "../SectionEyebrow";

const stepIcons = [IconCalendar, IconUser, IconSparkle] as const;

function StepArrow() {
  return (
    <span
      className="hidden shrink-0 px-1 text-lg font-light leading-none text-shalean-primary lg:inline-flex lg:items-center lg:self-center"
      aria-hidden
    >
      →
    </span>
  );
}

export function HowItWorksSection() {
  return (
    <section className="bg-white pb-6 pt-4 lg:pb-8 lg:pt-6" aria-labelledby="how-it-works-heading">
      <MarketingContainer>
        <div className="flex flex-col gap-8 rounded-3xl bg-shalean-soft-blue px-5 py-5 sm:px-6 sm:py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-8 lg:py-6">
          <div className="shrink-0">
            <SectionEyebrow className="tracking-[0.14em] text-shalean-primary">
              How It Works
            </SectionEyebrow>
            <h2
              id="how-it-works-heading"
              className="mt-3 text-sm font-bold leading-tight tracking-tight text-shalean-navy sm:text-[0.9375rem]"
            >
              Simple. Fast. Hassle-Free.
            </h2>
          </div>

          <ol className="flex min-w-0 flex-1 flex-col gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            {HOW_IT_WORKS.map((step, index) => {
              const Icon = stepIcons[index] ?? IconCalendar;
              return (
                <li key={step.step} className="contents">
                  <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-shalean-primary ring-1 ring-white/90 sm:h-10 sm:w-10">
                      <Icon className="h-4 w-4 sm:h-[1.125rem] sm:w-[1.125rem]" />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-shalean-primary text-[10px] font-bold text-white">
                          {step.step}
                        </span>
                        <h3 className="text-sm font-bold text-shalean-navy sm:text-[0.9375rem]">{step.title}</h3>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-600 sm:text-sm">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  {index < HOW_IT_WORKS.length - 1 ? (
                    <>
                      <StepArrow />
                      <span className="text-lg font-light text-shalean-primary lg:hidden" aria-hidden>
                        →
                      </span>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      </MarketingContainer>
    </section>
  );
}
