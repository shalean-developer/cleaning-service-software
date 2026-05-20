import Image from "next/image";
import Link from "next/link";
import { MARKETING_SERVICES_HOMEPAGE } from "@/features/marketing/constants";
import { customerBookServicePath } from "@/features/booking-wizard/bookServiceRoute";
import { MarketingButton } from "../MarketingButton";
import { MarketingContainer } from "../MarketingContainer";
import { SectionEyebrow } from "../SectionEyebrow";

export function ServicesSection() {
  return (
    <section id="services" className="marketing-section !pb-8 bg-white lg:!pb-10" aria-labelledby="services-heading">
      <MarketingContainer>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <SectionEyebrow>Our Services</SectionEyebrow>
            <h2
              id="services-heading"
              className="mt-3 text-3xl font-bold tracking-tight text-shalean-navy md:text-4xl"
            >
              Cleaning Services Tailored to Your Needs
            </h2>
          </div>
          <MarketingButton
            href="#services"
            variant="secondary"
            className="!h-12 !shrink-0 !self-start !rounded-[13px] lg:self-auto"
          >
            View All Services
          </MarketingButton>
        </div>

        <ul className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {MARKETING_SERVICES_HOMEPAGE.map((service) => (
            <li key={service.slug} className="min-w-0">
              <article className="group flex h-full min-h-[21.5rem] flex-col overflow-hidden rounded-[1.375rem] border border-shalean-border bg-white transition hover:-translate-y-0.5 hover:marketing-card-shadow xl:min-h-[22.5rem]">
                <div className="relative h-[10.5rem] overflow-hidden xl:h-[11.5rem]">
                  <Image
                    src={service.image}
                    alt={service.imageAlt}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center rounded-full bg-shalean-soft-blue text-sm font-bold text-shalean-primary ring-4 ring-white xl:h-12 xl:w-12">
                    {service.title.charAt(0)}
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-5 xl:p-6">
                  <h3 className="text-lg font-bold text-shalean-navy">{service.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                    {service.description}
                  </p>
                  <Link
                    href={customerBookServicePath(service.slug)}
                    className="mt-4 inline-flex items-center text-sm font-semibold text-shalean-primary hover:text-blue-600"
                  >
                    Learn More
                    <span className="ml-1" aria-hidden>
                      →
                    </span>
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      </MarketingContainer>
    </section>
  );
}
