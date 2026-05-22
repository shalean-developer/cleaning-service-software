import Link from "next/link";
import {
  LOCATION_REGIONS,
  regionAreaHref,
} from "@/features/marketing/locationAuthorityContent";
import { cleaningServicesInAreaLabel } from "@/features/marketing/locationNearbyAreas";
import {
  BOOKING_PATH,
  MARKETING_NAV_PATHS,
} from "@/features/marketing/constants";
import { MarketingButton } from "./MarketingButton";

const sectionHeading =
  "text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl";

export function LocationsHubRegionsSection() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <section aria-labelledby="regions-heading">
        <h2 id="regions-heading" className={sectionHeading}>
          Cape Town regions we cover
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          Browse suburb pages by region — each includes local service guidance, pricing notes, and
          booking for your neighbourhood.
        </p>
        <div className="mt-8 space-y-10">
          {LOCATION_REGIONS.map((region) => (
            <article
              key={region.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6"
            >
              <h3 className="text-lg font-bold text-shalean-navy">{region.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{region.intro}</p>
              <ul className="mt-4 flex flex-wrap gap-2">
                {region.areas.map((area) => (
                  <li key={area}>
                    <Link
                      href={regionAreaHref(area)}
                      className="marketing-focus-ring inline-flex min-h-9 max-w-full items-center justify-center rounded-full border border-shalean-soft-blue/80 bg-shalean-soft-blue/50 px-3.5 py-1.5 text-sm font-medium text-shalean-primary transition hover:border-shalean-primary/35 hover:bg-shalean-soft-blue"
                      aria-label={cleaningServicesInAreaLabel(area)}
                    >
                      {cleaningServicesInAreaLabel(area)}
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border border-shalean-primary/15 bg-shalean-primary/[0.04] p-6 sm:p-8"
        aria-labelledby="hub-cta-heading"
      >
        <h2 id="hub-cta-heading" className={sectionHeading}>
          Book cleaning in your suburb
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          Compare services and transparent pricing, then book vetted cleaners online in minutes.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <MarketingButton href={BOOKING_PATH}>Book online</MarketingButton>
          <MarketingButton href={MARKETING_NAV_PATHS.services} variant="secondary">
            All cleaning services
          </MarketingButton>
          <MarketingButton href={MARKETING_NAV_PATHS.pricing} variant="secondary">
            Cape Town cleaning prices
          </MarketingButton>
        </div>
      </section>
    </div>
  );
}
