import Link from "next/link";
import {
  cleaningServicesInAreaLabel,
  getNearbyLocationLinks,
} from "@/features/marketing/locationNearbyAreas";
import type { LocationSeoSlug } from "@/features/marketing/marketing-routes";

type Props = {
  slug: LocationSeoSlug;
};

export function LocationNearbyAreasSection({ slug }: Props) {
  const nearby = getNearbyLocationLinks(slug);
  if (nearby.length === 0) return null;

  return (
    <section aria-labelledby="nearby-areas-heading">
      <h2
        id="nearby-areas-heading"
        className="text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl"
      >
        Nearby cleaning areas
      </h2>
      <ul className="mt-4 flex flex-col gap-2">
        {nearby.map((item) => (
          <li key={item.slug}>
            <Link
              href={item.path}
              className="marketing-focus-ring text-sm font-medium text-shalean-primary hover:underline"
              aria-label={cleaningServicesInAreaLabel(item.area)}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
