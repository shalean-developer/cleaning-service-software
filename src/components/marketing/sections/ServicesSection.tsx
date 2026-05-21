import Link from "next/link";
import {
  MARKETING_SERVICES,
  SERVICES_SECTION,
  SERVICE_SEO_PATHS,
  marketingBookPath,
  serviceFromPrice,
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

        <ul className="mt-14 grid auto-rows-fr grid-cols-1 gap-6 sm:mt-16 sm:grid-cols-2 sm:gap-7 lg:mt-20 lg:grid-cols-3 lg:gap-8">
          {MARKETING_SERVICES.map((service) => {
            const seoHref = SERVICE_SEO_PATHS[service.slug];
            const bookHref = marketingBookPath(service.slug);
            const fromPrice = serviceFromPrice(service.slug);
            const serviceDetailLabel = `View ${service.title} in Cape Town`;

            return (
              <li key={service.slug} className="min-w-0">
                <article className="group marketing-card-hover relative flex h-full min-h-[17.5rem] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-7 sm:min-h-[18rem] sm:p-8">
                  <div className="relative z-10 flex flex-1 flex-col pr-20 sm:pr-24">
                    <h3 className="text-xl font-bold tracking-tight text-shalean-navy sm:text-[1.375rem]">
                      <Link
                        href={seoHref}
                        className="marketing-focus-ring rounded-sm hover:text-shalean-primary"
                      >
                        {service.title}
                      </Link>
                    </h3>
                    <p className="mt-3 line-clamp-2 text-[0.9375rem] leading-relaxed text-slate-600">
                      {service.cardTagline}
                    </p>

                    <div className="mt-auto pt-8">
                      <p className="text-xs font-medium text-slate-500">
                        From {fromPrice}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <Link
                          href={bookHref}
                          className="marketing-focus-ring inline-flex h-10 items-center justify-center rounded-full bg-shalean-primary px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-600"
                          aria-label={`Book ${service.title} in Cape Town online`}
                        >
                          Book {service.title}
                        </Link>
                        <Link
                          href={seoHref}
                          className="marketing-focus-ring text-sm font-medium text-slate-600 transition-colors hover:text-shalean-primary"
                          aria-label={serviceDetailLabel}
                        >
                          {serviceDetailLabel}
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="pointer-events-none absolute bottom-6 right-6 z-10 sm:bottom-7 sm:right-7">
                    <ServiceCardIcon slug={service.slug} />
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </MarketingContainer>
    </section>
  );
}
