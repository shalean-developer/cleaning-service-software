import {
  BOOKING_PATH,
  areaLocationPath,
  APPLY_PATH,
  CAPE_TOWN_AREAS,
  MARKETING_SERVICES,
  SERVICE_SEO_PATHS,
  marketingBookPath,
} from "./constants";
import type { ServiceSlug } from "@/features/pricing/server/types";

export type ServicesHubOfferingCard = {
  id: string;
  title: string;
  description: string;
  benefit: string;
  ctaLabel: string;
  iconSlug?: ServiceSlug;
  href?: string;
  bookHref?: string;
  comingSoon?: boolean;
};

export type ServicesHubPopularCard = {
  slug: ServiceSlug;
  bestFor: string;
  duration: string;
  ctaLabel: string;
};

export type ServicesHubUseCase = {
  id: string;
  title: string;
  intro: string;
  image: string;
  imageAlt: string;
  links: { label: string; href: string }[];
};

const movePath = SERVICE_SEO_PATHS["moving-cleaning"];

/** Services hub hero — distinct from homepage hero copy. */
export const SERVICES_HUB_HERO = {
  eyebrow: "Service directory",
  h1: "Find the Right Cleaning Service in Cape Town",
  intro:
    "Explore Shalean's full range of cleaning services, compare what's included, view pricing guidance, and find the right solution for your home, rental, or workspace.",
  trustLine: "6 live services · vetted teams · instant online quotes",
} as const;

/** Full service ecosystem grid (live + coming soon). */
export const SERVICES_HUB_ECOSYSTEM: ServicesHubOfferingCard[] = [
  {
    id: "regular-cleaning",
    title: "Regular Cleaning",
    description: "Routine home cleaning for kitchens, bathrooms, and living spaces.",
    benefit: "Ideal for busy households",
    ctaLabel: "Explore regular cleaning",
    iconSlug: "regular-cleaning",
    href: SERVICE_SEO_PATHS["regular-cleaning"],
    bookHref: marketingBookPath("regular-cleaning"),
  },
  {
    id: "deep-cleaning",
    title: "Deep Cleaning",
    description: "Intensive top-to-bottom refresh for seasonal and neglected areas.",
    benefit: "Best before events or handovers",
    ctaLabel: "Explore deep cleaning",
    iconSlug: "deep-cleaning",
    href: SERVICE_SEO_PATHS["deep-cleaning"],
    bookHref: marketingBookPath("deep-cleaning"),
  },
  {
    id: "move-in",
    title: "Move-In Cleaning",
    description: "Arrive to a spotless home with kitchens, bathrooms, and floors reset.",
    benefit: "Perfect for new tenants",
    ctaLabel: "Explore move-in cleaning",
    iconSlug: "moving-cleaning",
    href: movePath,
    bookHref: marketingBookPath("moving-cleaning"),
  },
  {
    id: "move-out",
    title: "Move-Out Cleaning",
    description: "Handover-ready cleaning for landlords, agents, and departing tenants.",
    benefit: "Deposit-friendly finish",
    ctaLabel: "Explore move-out cleaning",
    iconSlug: "moving-cleaning",
    href: movePath,
    bookHref: marketingBookPath("moving-cleaning"),
  },
  {
    id: "airbnb-cleaning",
    title: "Airbnb Cleaning",
    description: "Fast guest turnovers with checklist-ready attention to detail.",
    benefit: "Built for short-term hosts",
    ctaLabel: "Explore Airbnb cleaning",
    iconSlug: "airbnb-cleaning",
    href: SERVICE_SEO_PATHS["airbnb-cleaning"],
    bookHref: marketingBookPath("airbnb-cleaning"),
  },
  {
    id: "office-cleaning",
    title: "Office Cleaning",
    description: "Professional workspace cleaning for offices, studios, and teams.",
    benefit: "Flexible commercial schedules",
    ctaLabel: "Explore office cleaning",
    iconSlug: "office-cleaning",
    href: SERVICE_SEO_PATHS["office-cleaning"],
    bookHref: marketingBookPath("office-cleaning"),
  },
  {
    id: "carpet-cleaning",
    title: "Carpet Cleaning",
    description: "Targeted carpet and upholstery care for high-traffic zones.",
    benefit: "Refresh without full deep clean",
    ctaLabel: "Explore carpet cleaning",
    iconSlug: "carpet-cleaning",
    href: SERVICE_SEO_PATHS["carpet-cleaning"],
    bookHref: marketingBookPath("carpet-cleaning"),
  },
  {
    id: "post-construction",
    title: "Post-Construction Cleaning",
    description: "Dust, debris, and builder-residue removal for newly finished spaces.",
    benefit: "Launching soon in Cape Town",
    ctaLabel: "Coming soon",
    comingSoon: true,
  },
  {
    id: "window-cleaning",
    title: "Window Cleaning",
    description: "Streak-free interior and exterior glass for homes and offices.",
    benefit: "Launching soon in Cape Town",
    ctaLabel: "Coming soon",
    comingSoon: true,
  },
];

export const SERVICES_HUB_POPULAR: ServicesHubPopularCard[] = [
  {
    slug: "regular-cleaning",
    bestFor: "Weekly or bi-weekly home upkeep",
    duration: "Typically 3–5 hours",
    ctaLabel: "Book regular cleaning",
  },
  {
    slug: "deep-cleaning",
    bestFor: "Seasonal refreshes and pre-event cleans",
    duration: "Typically 5–8 hours",
    ctaLabel: "Book deep cleaning",
  },
  {
    slug: "airbnb-cleaning",
    bestFor: "Guest turnovers between check-in and check-out",
    duration: "Typically 2–4 hours",
    ctaLabel: "Book Airbnb cleaning",
  },
];

export const SERVICES_HUB_BENEFITS = [
  {
    id: "vetted",
    title: "Vetted cleaners",
    description: "Background-checked professionals you can trust in your home.",
  },
  {
    id: "payments",
    title: "Secure online payments",
    description: "Encrypted checkout with confirmed booking details upfront.",
  },
  {
    id: "scheduling",
    title: "Flexible scheduling",
    description: "One-off or recurring visits that fit your calendar.",
  },
  {
    id: "coverage",
    title: "Cape Town-wide coverage",
    description: "Homes, Airbnb properties, and offices across the metro.",
  },
] as const;

export const SERVICES_HUB_USE_CASES: ServicesHubUseCase[] = [
  {
    id: "homes",
    title: "Cleaning for homes",
    intro:
      "Keep everyday spaces fresh with structured regular cleaning, periodic deep refreshes, and recurring visits you manage from your account.",
    image: MARKETING_SERVICES.find((s) => s.slug === "regular-cleaning")!.image,
    imageAlt: "Regular home cleaning in Cape Town",
    links: [
      { label: "Regular home cleaning in Cape Town", href: SERVICE_SEO_PATHS["regular-cleaning"] },
      { label: "Deep cleaning services in Cape Town", href: SERVICE_SEO_PATHS["deep-cleaning"] },
      {
        label: "Compare Cape Town cleaning prices",
        href: "/cleaning-prices-cape-town",
      },
    ],
  },
  {
    id: "hosts",
    title: "Cleaning for property hosts",
    intro:
      "Turnover cleaning between guests, checklist-ready resets, and reliable scheduling when check-in windows are tight.",
    image: MARKETING_SERVICES.find((s) => s.slug === "airbnb-cleaning")!.image,
    imageAlt: "Airbnb turnover cleaning in Cape Town",
    links: [
      { label: "Airbnb cleaning in Cape Town", href: SERVICE_SEO_PATHS["airbnb-cleaning"] },
      { label: "Deep cleaning for rental resets", href: SERVICE_SEO_PATHS["deep-cleaning"] },
      { label: "Cleaning FAQs for hosts", href: "/faq" },
    ],
  },
  {
    id: "businesses",
    title: "Cleaning for businesses",
    intro:
      "Office and workspace cleaning with transparent scope, insured teams, and schedules that match your operating hours.",
    image: MARKETING_SERVICES.find((s) => s.slug === "office-cleaning")!.image,
    imageAlt: "Office cleaning in Cape Town",
    links: [
      { label: "Office cleaning in Cape Town", href: SERVICE_SEO_PATHS["office-cleaning"] },
      { label: "Regular cleaning for small teams", href: SERVICE_SEO_PATHS["regular-cleaning"] },
      { label: "Contact Shalean for commercial quotes", href: "/contact" },
    ],
  },
  {
    id: "specialized",
    title: "Specialized cleaning",
    intro:
      "Move handovers, carpet care, and intensive deep cleans when standard upkeep is not enough.",
    image: MARKETING_SERVICES.find((s) => s.slug === "carpet-cleaning")!.image,
    imageAlt: "Specialized carpet cleaning in Cape Town",
    links: [
      { label: "Move-in/out cleaning in Cape Town", href: SERVICE_SEO_PATHS["moving-cleaning"] },
      { label: "Carpet cleaning in Cape Town", href: SERVICE_SEO_PATHS["carpet-cleaning"] },
      { label: "Deep cleaning in Cape Town", href: SERVICE_SEO_PATHS["deep-cleaning"] },
    ],
  },
];

/** All Cape Town suburb pages linked from the services hub locations block. */
export const SERVICES_HUB_FEATURED_AREAS = CAPE_TOWN_AREAS;

export function cleaningServicesInAreaLabel(area: string): string {
  return `Cleaning services in ${area}`;
}

export const SERVICES_HUB_RECURRING = {
  title: "Recurring cleaning, on your schedule",
  paragraphs: [
    "Choose weekly, bi-weekly, monthly, or multi-day schedules for regular home cleaning. Each visit is booked and paid individually — pay per visit with no subscription lock-in and no automatic charges for future dates.",
    "Upcoming visits appear in your account so you can adjust timing, add rooms, or skip a date before the next clean.",
  ],
  ctaLabel: "Explore recurring cleaning",
  ctaHref: marketingBookPath("regular-cleaning"),
} as const;

export const SERVICES_HUB_FINAL_CTA = {
  book: {
    title: "Book a cleaning",
    description: "Get an instant quote and confirm your Cape Town clean online.",
    href: BOOKING_PATH,
    label: "Book a cleaning",
  },
  apply: {
    title: "Become a cleaner",
    description: "Join Shalean's vetted network and accept offers across Cape Town.",
    href: APPLY_PATH,
    label: "Apply to clean with Shalean",
  },
} as const;
