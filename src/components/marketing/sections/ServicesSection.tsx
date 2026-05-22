import Link from "next/link";
import {
  MARKETING_SERVICES,
  SERVICES_SECTION,
  SERVICE_SEO_PATHS,
} from "@/features/marketing/constants";
import { MarketingContainer } from "../MarketingContainer";
import { SectionEyebrow } from "../SectionEyebrow";
import { ServiceCardIcon } from "../ServiceCardIcon";

export function ServicesSection() {
  return (
    <section
      id="services"
      className="marketing-section relative bg-shalean-surface !pt-8 sm:!pt-10 lg:!pt-12"
      aria-labelledby="services-heading"
    >
      <MarketingContainer>
        <header className="mx-auto max-w-3xl text-center">
          <SectionEyebrow className="tracking-[0.12em] text-shalean-primary">
            {SERVICES_SECTION.eyebrow}
          </SectionEyebrow>
          <h2
            id="services-heading"
            className="mt-4 text-3xl font-bold tracking-tight text-shalean-navy sm:text-4xl lg:text-[2.5rem] lg:leading-[1.15]"
          >
            {SERVICES_SECTION.heading}
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate-600 sm:text-lg sm:leading-relaxed">
            {SERVICES_SECTION.subtitle}
          </p>
        </header>

        <ul className="mt-14 grid grid-cols-1 items-stretch gap-6 sm:mt-16 sm:grid-cols-2 sm:gap-7 lg:mt-20 lg:grid-cols-3 lg:gap-8">
          {MARKETING_SERVICES.map((service) => {
            const seoHref = SERVICE_SEO_PATHS[service.slug];
            const serviceDetailLabel = `View ${service.title} in Cape Town`;

            return (
              <li key={service.slug} className="flex min-w-0">
                <article className="group marketing-card-hover flex h-full w-full flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-7 sm:p-8">
                  <h3 className="text-xl font-bold tracking-tight text-shalean-navy sm:text-[1.375rem]">
                    <Link
                      href={seoHref}
                      className="marketing-focus-ring rounded-sm hover:text-shalean-primary"
                    >
                      {service.title}
                    </Link>
                  </h3>

                  <div className="mt-3 flex items-end gap-3 sm:gap-4">
                    <p className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed text-slate-600">
                      {service.cardTagline}
                    </p>
                    <ServiceCardIcon slug={service.slug} className="pointer-events-none shrink-0" />
                  </div>

                  <Link
                    href={seoHref}
                    className="marketing-focus-ring mt-auto pt-5 text-sm font-semibold text-shalean-primary transition-colors hover:text-blue-600 sm:pt-6"
                    aria-label={serviceDetailLabel}
                  >
                    {serviceDetailLabel}
                  </Link>
                </article>
              </li>
            );
          })}
        </ul>
      </MarketingContainer>
    </section>
  );
}
