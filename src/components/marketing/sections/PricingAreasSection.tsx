import Image from "next/image";
import Link from "next/link";
import {
  CAPE_TOWN_AREAS,
  MARKETING_IMAGES,
  PRICING_PREVIEW,
} from "@/features/marketing/constants";
import { MarketingContainer } from "../MarketingContainer";
import { SectionEyebrow } from "../SectionEyebrow";

export function PricingAreasSection() {
  return (
    <section className="marketing-section bg-white" aria-labelledby="pricing-areas-heading">
      <MarketingContainer>
        <h2 id="pricing-areas-heading" className="sr-only">
          Pricing and service areas
        </h2>

        <div className="grid gap-1 lg:grid-cols-2 lg:gap-1">
          {/* Pricing row */}
          <div className="flex flex-col gap-6 sm:flex-row sm:gap-0">
            <div
              id="pricing"
              className="flex min-h-[22.5rem] flex-1 flex-col rounded-3xl border border-shalean-border bg-white p-8 marketing-card-shadow sm:rounded-r-none sm:border-r-0"
            >
              <SectionEyebrow>Pricing</SectionEyebrow>
              <h3 className="mt-3 text-xl font-bold text-shalean-navy md:text-2xl">
                Affordable. Transparent. Fair.
              </h3>

              <ul className="mt-6 flex-1 space-y-3">
                {PRICING_PREVIEW.map((item) => (
                  <li
                    key={item.slug}
                    className="flex items-center justify-between border-b border-shalean-border/80 pb-3 text-sm last:border-0"
                  >
                    <span className="font-medium text-shalean-navy">{item.name}</span>
                    <span className="text-slate-600">
                      Starting from{" "}
                      <span className="font-bold text-shalean-primary">{item.fromPrice}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href="#pricing"
                className="mt-6 inline-flex items-center text-sm font-semibold text-shalean-primary hover:text-blue-600"
              >
                View Full Pricing
                <span className="ml-1" aria-hidden>
                  →
                </span>
              </Link>
            </div>

            <div className="relative hidden w-[12.5rem] shrink-0 overflow-hidden rounded-3xl rounded-l-none sm:block marketing-card-shadow">
              <Image
                src={MARKETING_IMAGES.pricingLifestyle}
                alt="Smiling professional cleaner in blue uniform holding cleaning supplies"
                fill
                sizes="200px"
                className="object-cover"
              />
            </div>
          </div>

          {/* Areas row */}
          <div className="flex flex-col gap-6 sm:flex-row sm:gap-0">
            <div
              id="areas"
              className="flex min-h-[22.5rem] flex-1 flex-col rounded-3xl border border-shalean-border bg-white p-8 marketing-card-shadow sm:rounded-r-none sm:border-r-0"
            >
              <SectionEyebrow>Areas We Serve</SectionEyebrow>
              <h3 className="mt-3 text-xl font-bold text-shalean-navy md:text-2xl">
                Proudly Serving Cape Town
              </h3>

              <ul className="mt-6 grid grid-cols-3 gap-2.5">
                {CAPE_TOWN_AREAS.map((area) => (
                  <li key={area}>
                    <Link
                      href="#contact"
                      className="flex h-9 min-w-0 items-center justify-center rounded-full border border-shalean-border bg-shalean-surface px-2 text-center text-xs font-medium text-shalean-primary transition hover:border-shalean-primary hover:bg-shalean-soft-blue sm:text-sm"
                    >
                      {area}
                    </Link>
                  </li>
                ))}
              </ul>

              <Link
                href="#areas"
                className="mt-6 inline-flex items-center text-sm font-semibold text-shalean-primary hover:text-blue-600"
              >
                View All Areas
                <span className="ml-1" aria-hidden>
                  →
                </span>
              </Link>
            </div>

            <div className="relative hidden w-[12.5rem] shrink-0 overflow-hidden rounded-3xl rounded-l-none sm:block marketing-card-shadow">
              <Image
                src={MARKETING_IMAGES.capeTownAerial}
                alt="Aerial view of Cape Town coastline with Table Mountain"
                fill
                sizes="200px"
                loading="lazy"
                className="object-cover"
              />
            </div>
          </div>
        </div>

        {/* Mobile / tablet companion images when side images are hidden */}
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:hidden">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src={MARKETING_IMAGES.pricingLifestyle}
              alt="Professional cleaner with supplies"
              fill
              sizes="50vw"
              loading="lazy"
              className="object-cover"
            />
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src={MARKETING_IMAGES.capeTownAerial}
              alt="Cape Town coastline and Table Mountain"
              fill
              sizes="50vw"
              loading="lazy"
              className="object-cover"
            />
          </div>
        </div>
      </MarketingContainer>
    </section>
  );
}
