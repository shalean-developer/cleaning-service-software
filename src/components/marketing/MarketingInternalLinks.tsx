import Link from "next/link";
import {
  CONTACT_PAGE_PATH,
  FAQ_PAGE_PATH,
  LOCATIONS_HUB_PATH,
  PRICING_PAGE_PATH,
} from "@/features/marketing/marketing-routes";
import {
  serviceLinksFromPaths,
  type ServiceLinkItem,
} from "@/features/marketing/link-labels";

const linkClass =
  "marketing-focus-ring text-sm font-medium text-shalean-primary transition hover:text-blue-700";

type MarketingInternalLinksProps = {
  servicePaths?: string[];
  serviceLinks?: ServiceLinkItem[];
  showPricing?: boolean;
  showFaq?: boolean;
  showContact?: boolean;
  showLocations?: boolean;
  showHome?: boolean;
};

export function MarketingInternalLinks({
  servicePaths = [],
  serviceLinks: serviceLinksProp,
  showPricing = true,
  showFaq = true,
  showContact = true,
  showLocations = true,
  showHome = true,
}: MarketingInternalLinksProps) {
  const serviceLinks =
    serviceLinksProp ?? (servicePaths.length > 0 ? serviceLinksFromPaths(servicePaths) : []);

  return (
    <nav
      aria-label="Related pages"
      className="mt-12 rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8"
    >
      <h2 className="text-lg font-bold text-shalean-navy">Explore Shalean</h2>
      <ul className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
        {showHome ? (
          <li>
            <Link href="/" className={linkClass} aria-label="Shalean homepage">
              Home
            </Link>
          </li>
        ) : null}
        {showPricing ? (
          <li>
            <Link
              href={PRICING_PAGE_PATH}
              className={linkClass}
              aria-label="See cleaning prices in Cape Town"
            >
              Cleaning prices Cape Town
            </Link>
          </li>
        ) : null}
        {showFaq ? (
          <li>
            <Link
              href={FAQ_PAGE_PATH}
              className={linkClass}
              aria-label="Read cleaning service frequently asked questions"
            >
              Cleaning FAQs
            </Link>
          </li>
        ) : null}
        {showContact ? (
          <li>
            <Link
              href={CONTACT_PAGE_PATH}
              className={linkClass}
              aria-label="Contact Shalean Cleaning Services"
            >
              Contact Shalean
            </Link>
          </li>
        ) : null}
        {showLocations ? (
          <li>
            <Link
              href={LOCATIONS_HUB_PATH}
              className={linkClass}
              aria-label="View Cape Town cleaning service areas"
            >
              Cape Town service areas
            </Link>
          </li>
        ) : null}
        {serviceLinks.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={linkClass}
              aria-label={`View ${item.label}`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
