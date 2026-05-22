import Link from "next/link";
import { areaLocationPath } from "@/features/marketing/constants";
import {
  LOCATIONS_HUB_CROSS_LINK,
  PRICING_HUB_FEATURED_AREAS,
  pricingAreaAnchorText,
} from "@/features/marketing/serviceLocationCrossLinks";

const sectionHeading =
  "text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl";

export function PricingHubAreaLinksSection() {
  return (
    <section aria-labelledby="pricing-popular-areas-heading">
      <h2 id="pricing-popular-areas-heading" className={sectionHeading}>
        Popular areas we serve
      </h2>
      <p className="mt-3 text-base leading-relaxed text-slate-600">
        Metro-wide starting prices apply across Cape Town — suburb pages explain local service
        options and booking for your neighbourhood.
      </p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {PRICING_HUB_FEATURED_AREAS.map((area) => (
          <li key={area}>
            <Link
              href={areaLocationPath(area)}
              className="marketing-focus-ring inline-flex min-h-9 max-w-full items-center justify-center rounded-full border border-shalean-soft-blue/80 bg-shalean-soft-blue/40 px-3.5 py-1.5 text-sm font-medium text-shalean-primary transition hover:border-shalean-primary/35 hover:bg-shalean-soft-blue"
              aria-label={pricingAreaAnchorText(area)}
            >
              {pricingAreaAnchorText(area)}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-5">
        <Link
          href={LOCATIONS_HUB_CROSS_LINK.href}
          className="marketing-focus-ring text-sm font-semibold text-shalean-primary hover:underline"
        >
          {LOCATIONS_HUB_CROSS_LINK.label}
        </Link>
      </p>
    </section>
  );
}
