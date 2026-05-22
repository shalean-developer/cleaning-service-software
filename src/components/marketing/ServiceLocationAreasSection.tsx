import Link from "next/link";
import type { ServiceSeoSlug } from "@/features/marketing/seo-pages";
import {
  getServiceLocationCrossLinksBySeoSlug,
  LOCATIONS_HUB_CROSS_LINK,
} from "@/features/marketing/serviceLocationCrossLinks";

const sectionHeading =
  "text-xl font-bold tracking-tight text-shalean-navy sm:text-2xl";

type Props = {
  seoSlug: ServiceSeoSlug;
};

export function ServiceLocationAreasSection({ seoSlug }: Props) {
  const { introCopy, links } = getServiceLocationCrossLinksBySeoSlug(seoSlug);

  return (
    <section aria-labelledby="service-areas-heading">
      <h2 id="service-areas-heading" className={sectionHeading}>
        Available in Cape Town areas
      </h2>
      <p className="mt-3 text-base leading-relaxed text-slate-600">{introCopy}</p>
      <ul className="mt-5 flex flex-wrap gap-2">
        {links.map((link) => (
          <li key={link.slug}>
            <Link
              href={link.href}
              className="marketing-focus-ring inline-flex min-h-9 max-w-full items-center justify-center rounded-full border border-shalean-soft-blue/80 bg-shalean-soft-blue/40 px-3.5 py-1.5 text-sm font-medium text-shalean-primary transition hover:border-shalean-primary/35 hover:bg-shalean-soft-blue"
              aria-label={link.anchorText}
            >
              {link.anchorText}
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
