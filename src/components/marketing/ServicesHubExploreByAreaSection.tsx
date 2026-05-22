import Link from "next/link";
import { LOCATION_REGIONS, regionAreaHref } from "@/features/marketing/locationAuthorityContent";
import { cleaningServicesInAreaLabel } from "@/features/marketing/locationNearbyAreas";
import { LOCATIONS_HUB_PATH } from "@/features/marketing/marketing-routes";

type Props = {
  /** When true, render compact variant for embedding in existing hub section. */
  compact?: boolean;
};

export function ServicesHubExploreByAreaSection({ compact = false }: Props) {
  return (
    <div className={compact ? "mt-6" : "mx-auto max-w-3xl"}>
      {!compact ? (
        <h2 className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl">
          Explore by area
        </h2>
      ) : null}
      <p className={`text-sm leading-relaxed text-slate-600 ${compact ? "mt-0" : "mt-3"}`}>
        Browse suburb pages for local service detail, pricing guidance, and booking. grouped by
        region.
      </p>
      <p className="mt-4">
        <Link
          href={LOCATIONS_HUB_PATH}
          className="marketing-focus-ring text-sm font-semibold text-shalean-primary hover:underline"
        >
          Cape Town locations hub
        </Link>
      </p>
      <div className={`space-y-6 ${compact ? "mt-6" : "mt-8"}`}>
        {LOCATION_REGIONS.map((region) => (
          <div key={region.id}>
            <h3 className="text-sm font-semibold text-shalean-navy">{region.title}</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {region.areas.map((area) => (
                <li key={area}>
                  <Link
                    href={regionAreaHref(area)}
                    className="marketing-focus-ring inline-flex min-h-8 items-center rounded-full border border-slate-200/90 bg-white px-3 py-1 text-xs font-medium text-shalean-primary transition hover:border-shalean-primary/30 sm:text-sm"
                    aria-label={cleaningServicesInAreaLabel(area)}
                  >
                    {cleaningServicesInAreaLabel(area)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
