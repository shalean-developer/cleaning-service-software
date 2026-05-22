import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";
import type { ServiceSlug } from "@/features/pricing/server/types";
import type { MarketingSectionId } from "@/lib/ui/scrollToSection";
export { SHALEAN_CONTACT, SHALEAN_SOCIAL } from "./contact";

export const BRAND = {
  primary: "#2563EB",
  navy: "#0F172A",
  softBlue: "#DBEAFE",
  sky: "#38BDF8",
  white: "#FFFFFF",
  bg: "#F8FAFC",
  border: "#E2E8F0",
} as const;

export type NavLink = {
  href: string;
  label: string;
  children?: readonly string[];
};

export type FooterQuickLink = {
  label: string;
  href: string;
};

export const FOOTER_QUICK_LINKS: readonly FooterQuickLink[] = [
  { label: "About Us", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/cleaning-prices-cape-town" },
  { label: "Locations", href: "/locations" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export type FooterSupportLink = {
  label: string;
  sectionId?: MarketingSectionId;
  href?: string;
};

export const SIGN_IN_PATH = "/sign-in" as const;
export const SIGN_UP_PATH = "/sign-up" as const;

/** Public role-selection page before customer or cleaner sign-in. */
export { AUTH_PATH } from "@/lib/auth/authEntryPaths";

export const CLEANER_SIGN_IN_PATH =
  `/sign-in?redirectedFrom=${encodeURIComponent("/cleaner/offers")}` as const;

/** Public cleaner recruitment funnel (not sign-in). */
export const APPLY_PATH = "/apply" as const;

export const FOOTER_SUPPORT_LINKS: readonly FooterSupportLink[] = [
  { label: "Apply to clean with Shalean", href: APPLY_PATH },
];

export const BUSINESS_HOURS = "Mon to Sat: 7:00 AM to 7:00 PM";

export function formatZarFromCents(cents: number): string {
  const amount = cents / 100;
  return amount % 1 === 0
    ? `R${amount.toLocaleString("en-ZA")}`
    : `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function estimateBasePriceCents(
  slug: ServiceSlug,
  bedrooms: number,
  bathrooms: number,
): number {
  const rule = SERVICE_CATALOG[slug];
  const extraBedrooms = Math.max(0, bedrooms - 1);
  const extraBathrooms = Math.max(0, bathrooms - 1);
  if (rule.perBedroomCents) {
    return rule.perBedroomCents * Math.max(1, bedrooms);
  }
  return (
    rule.baseCents +
    extraBedrooms * rule.extraBedroomCents +
    extraBathrooms * rule.extraBathroomCents
  );
}

/** Homepage hero subtitle (below H1). */
export const HOMEPAGE_HERO_SUBTITLE =
  "Professional cleaning services across Cape Town for homes, Airbnb properties, offices, and move-in or move-out support with transparent pricing and easy online booking." as const;

export const HERO_TRUST_ITEMS = [
  {
    id: "vetted",
    lines: ["Background", "Checked"] as const,
    icon: "shield" as const,
  },
  {
    id: "same-day",
    lines: ["Same-Day", "Availability"] as const,
    icon: "clock" as const,
  },
  {
    id: "eco",
    lines: ["Eco-Friendly", "Products"] as const,
    icon: "leaf" as const,
  },
  {
    id: "guarantee",
    lines: ["Satisfaction", "Guarantee"] as const,
    icon: "sparkle" as const,
  },
] as const;

/** Shown near booking CTAs. sets expectation for sign-up before booking. */
export const BOOKING_SIGNUP_HINT = "Free account · then book online in minutes";

export const STATS = [
  { value: "5,000+", label: "Homes Cleaned", icon: "home" as const },
  { value: "150+", label: "Professional Cleaners", icon: "users" as const },
  { value: "4.9★", label: "Average Rating", icon: "star" as const },
] as const;

export type MarketingServiceCard = {
  slug: ServiceSlug;
  title: string;
  /** Short 1–2 line copy for homepage service cards */
  cardTagline: string;
  description: string;
  image: string;
  imageAlt: string;
};

/** SEO landing paths for service cards (pages may be added later). */
export const SERVICE_SEO_PATHS: Record<ServiceSlug, string> = {
  "regular-cleaning": "/services/regular-cleaning-cape-town",
  "deep-cleaning": "/services/deep-cleaning-cape-town",
  "moving-cleaning": "/services/move-in-out-cleaning-cape-town",
  "airbnb-cleaning": "/services/airbnb-cleaning-cape-town",
  "office-cleaning": "/services/office-cleaning-cape-town",
  "carpet-cleaning": "/services/carpet-cleaning-cape-town",
};

export const SERVICES_SECTION = {
  eyebrow: "Professional Cleaning Services",
  heading: "Explore Shalean Cleaning Services",
  subtitle:
    "House cleaning, deep cleaning, Airbnb turnovers, and office cleaning across Cape Town. trusted by busy homes, hosts, and businesses.",
} as const;

export function serviceFromPrice(slug: ServiceSlug): string {
  return formatZarFromCents(SERVICE_CATALOG[slug].baseCents);
}

export const MARKETING_SERVICES: MarketingServiceCard[] = [
  {
    slug: "regular-cleaning",
    title: "Regular Cleaning",
    cardTagline:
      "Professional recurring home cleaning tailored for busy households.",
    description:
      "Routine cleaning for kitchens, bathrooms, and living spaces, perfect for busy households.",
    image:
      "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=800&q=80",
    imageAlt: "Regular home cleaning in a modern kitchen",
  },
  {
    slug: "deep-cleaning",
    title: "Deep Cleaning",
    cardTagline:
      "Intensive top-to-bottom refresh for seasonal cleans and neglected spaces.",
    description:
      "Intensive top-to-bottom clean for seasonal refreshes, spring cleans, and neglected areas.",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    imageAlt: "Deep cleaning service detail",
  },
  {
    slug: "moving-cleaning",
    title: "Move In/Out Cleaning",
    cardTagline:
      "Handover-ready cleaning for tenants, landlords, and property managers.",
    description:
      "Handover-ready cleaning for tenants, landlords, and property managers across Cape Town.",
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
    imageAlt: "Empty apartment ready after move-out cleaning",
  },
  {
    slug: "airbnb-cleaning",
    title: "Airbnb Cleaning",
    cardTagline: "Fast guest turnovers with checklist-ready attention to detail.",
    description:
      "Fast turnover cleans between guests with checklist-ready attention to detail.",
    image:
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80",
    imageAlt: "Bright short-term rental living space ready for guests",
  },
  {
    slug: "office-cleaning",
    title: "Office Cleaning",
    cardTagline: "Professional workspace cleaning for offices, studios, and teams.",
    description:
      "Professional workspace cleaning tailored to offices, studios, and shared workspaces.",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    imageAlt: "Modern office space cleaning",
  },
  {
    slug: "carpet-cleaning",
    title: "Carpet Cleaning",
    cardTagline: "Targeted carpet and upholstery care for high-traffic areas.",
    description:
      "Targeted carpet and upholstery refresh for high-traffic rooms and marked areas.",
    image:
      "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800&q=80",
    imageAlt: "Carpet cleaning service",
  },
];

const HOMEPAGE_SERVICE_SLUGS: ServiceSlug[] = [
  "regular-cleaning",
  "deep-cleaning",
  "moving-cleaning",
  "airbnb-cleaning",
];

/** Four services shown on the marketing homepage row; office & carpet remain in footer/booking. */
export const MARKETING_SERVICES_HOMEPAGE = MARKETING_SERVICES.filter((service) =>
  HOMEPAGE_SERVICE_SLUGS.includes(service.slug),
);

export const SERVICES_SECTION_INTRO =
  "From weekly home care and deep refreshes to move handovers and guest-ready turnovers, book insured cleaners across Cape Town in minutes. Office and carpet cleaning are available in the same flow when you need them.";

export const HOW_IT_WORKS_SECTION = {
  eyebrow: "How It Works",
  heading: "Simple. Fast. Hassle-Free.",
  subtitle: "Book trusted professional cleaners in just a few easy steps.",
} as const;

export const HOW_IT_WORKS = [
  {
    step: 1,
    title: "Book Online",
    description: "Choose a service, pick a date and get an instant quote.",
  },
  {
    step: 2,
    title: "Cleaner Arrives",
    description: "Our professional cleaner arrives on time, fully equipped.",
  },
  {
    step: 3,
    title: "We Clean",
    description: "We deliver a thorough, high-quality clean throughout your home.",
  },
  {
    step: 4,
    title: "Enjoy Your Clean Home",
    description: "Relax and enjoy a spotless home or office.",
  },
] as const;

export const WHY_CHOOSE_SECTION = {
  eyebrow: "Why Choose Shalean?",
  heading: "Trusted by Thousands of Happy Customers",
  subtitle:
    "Professional cleaners, secure booking, and premium service quality trusted across Cape Town.",
} as const;

export const WHY_CHOOSE = [
  {
    id: "vetted",
    title: "Vetted Cleaners",
    description: "Background-checked and professionally trained cleaners.",
  },
  {
    id: "insured",
    title: "Insured Service",
    description: "Full professional coverage for your peace of mind.",
  },
  {
    id: "eco",
    title: "Eco-Friendly",
    description: "Safe, eco-friendly products for your home.",
  },
  {
    id: "payments",
    title: "Secure Payments",
    description: "Encrypted online checkout you can trust.",
  },
  {
    id: "flexible",
    title: "Flexible Scheduling",
    description: "One-off or recurring bookings that fit your schedule.",
  },
  {
    id: "guarantee",
    title: "Satisfaction Guarantee",
    description: "We stand behind every clean with our guarantee.",
  },
] as const;

export const REVIEWS_SECTION = {
  eyebrow: "What Our Clients Say",
  heading: "Real Reviews from Real Customers",
  subtitle:
    "Cape Town homeowners, Airbnb hosts, and businesses trust Shalean for reliable, high-quality cleaning services.",
  ratingValue: "4.9",
  ratingLabel: "4.9 out of 5",
  reviewCountLabel: "Based on 1,200+ reviews",
  excellentLabel: "Excellent",
} as const;

export const REVIEWS = [
  {
    name: "Thandi M.",
    suburb: "Sea Point",
    context: "Regular cleaning",
    rating: 5,
    text: "Booking was effortless and our apartment looked brand new. The team was punctual, friendly, and thorough.",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
  },
  {
    name: "James K.",
    suburb: "Claremont",
    context: "Airbnb host",
    rating: 5,
    text: "We use Shalean for our Airbnb turnovers. Consistent quality every time, and guests always comment on how clean the place is.",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
  },
  {
    name: "Sarah L.",
    suburb: "Durbanville",
    context: "Deep cleaning",
    rating: 5,
    text: "Deep clean before moving in was exceptional. Transparent pricing and no surprises on the day.",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80",
  },
  {
    name: "David P.",
    suburb: "Camps Bay",
    context: "Same-day booking",
    rating: 5,
    text: "Same-day booking saved us before guests arrived. Professional, insured, and worth every rand.",
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
  },
] as const;

/** Concise crawlable copy for homepage topical authority (not a separate page). */
export const HOMEPAGE_LOCAL_SEO = {
  eyebrow: "Cape Town cleaning specialists",
  title: "Professional home cleaning you can trust",
  paragraphs: [
    "Shalean connects Cape Town homeowners, landlords, and hosts with vetted, insured cleaning professionals, from regular home cleaning and deep cleans to Airbnb turnovers and move-in/out services.",
    "Book online in minutes, see transparent pricing upfront, and enjoy the same high standards whether you are in Sea Point, Claremont, Camps Bay, or across the metro.",
  ],
} as const;

export type FooterTrustPoint = {
  id: string;
  label: string;
  icon: "shield" | "map" | "clock" | "sparkle";
};

export const FOOTER_TRUST_POINTS: readonly FooterTrustPoint[] = [
  { id: "vetted", label: "Vetted & insured cleaners", icon: "shield" },
  { id: "coverage", label: "Cape Town metro coverage", icon: "map" },
  { id: "support", label: "Mon–Sat support", icon: "clock" },
  { id: "guarantee", label: "Satisfaction guarantee", icon: "sparkle" },
];

export const FOOTER_BRAND = {
  description:
    "Premium Cape Town home & office cleaning with transparent pricing, insured professionals, and secure online booking.",
} as const;

export type FooterLegalLink = {
  label: string;
  href: string;
};

export const FOOTER_LEGAL_LINKS: readonly FooterLegalLink[] = [
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Refund Policy", href: "/refund-policy" },
];

/** Homepage pricing card. same four services as MARKETING_SERVICES_HOMEPAGE. */
export const PRICING_PREVIEW = HOMEPAGE_SERVICE_SLUGS.map((slug) => ({
  slug,
  name: SERVICE_CATALOG[slug].label,
  fromPrice: formatZarFromCents(SERVICE_CATALOG[slug].baseCents),
}));

export const PRICING_PANEL = {
  eyebrow: "Pricing",
  heading: "Affordable. Transparent. Fair.",
  subtitle:
    "Cleaning prices in Cape Town for homes, Airbnb properties, and offices. see starting rates before you book.",
  microcopy: "No hidden costs.",
  ctaLabel: "See Cape Town cleaning prices",
} as const;

/** Canonical public pricing hub URL. */
export const PRICING_AUTHORITY_PATH = "/cleaning-prices-cape-town" as const;

export const AREAS_PANEL = {
  eyebrow: "Areas We Serve",
  heading: "Proudly Serving Cape Town",
  subtitle: "Trusted cleaning services across Cape Town suburbs and surrounding areas.",
  ctaLabel: "View All Areas",
} as const;

/** SEO locations hub. */
export const AREAS_HUB_PATH = "/locations" as const;

/** SEO suburb landing path pattern. */
export function areaLocationPath(area: string): string {
  const slug = area.toLowerCase().replace(/\s+/g, "-");
  return `/locations/${slug}-cape-town`;
}

export type HeaderNavLink = {
  label: string;
  href?: string;
  sectionId?: MarketingSectionId;
  /** When false, rendered as non-interactive copy (no misleading href). */
  enabled?: boolean;
};

/** Canonical marketing paths for header/footer nav (aligned with marketing-routes). */
export const MARKETING_NAV_PATHS = {
  services: "/services",
  about: "/about",
  locations: AREAS_HUB_PATH,
  pricing: PRICING_AUTHORITY_PATH,
  faq: "/faq",
  contact: "/contact",
} as const;

/** Canonical 12 SEO suburb display names. sourced from location registry. */
export { SEO_LOCATION_NAMES as CAPE_TOWN_AREAS } from "@/features/locations/locationRegistry";

/** Unauthenticated users are sent to sign-in with this path preserved after login. */
export const BOOKING_PATH = "/customer/book" as const;

/** Product-first platform navigation (desktop center + mobile primary). */
export const HEADER_PRIMARY_NAV: readonly HeaderNavLink[] = [
  { href: BOOKING_PATH, label: "Book Cleaning" },
  { href: MARKETING_NAV_PATHS.services, label: "Services" },
  { href: MARKETING_NAV_PATHS.about, label: "About" },
  { href: APPLY_PATH, label: "Apply" },
  { href: MARKETING_NAV_PATHS.locations, label: "Locations" },
];

/** Desktop header utility links (FAQ, contact. right of primary nav). */
export const HEADER_UTILITY_NAV: readonly HeaderNavLink[] = [
  { href: MARKETING_NAV_PATHS.faq, label: "FAQ" },
  { href: MARKETING_NAV_PATHS.contact, label: "Contact" },
];

/** Lower-priority links. mobile drawer & footer-style discovery. */
export const HEADER_SECONDARY_NAV: readonly HeaderNavLink[] = [
  { href: CLEANER_SIGN_IN_PATH, label: "Cleaner sign in" },
  { href: MARKETING_NAV_PATHS.faq, label: "FAQ" },
  { href: MARKETING_NAV_PATHS.contact, label: "Contact" },
  { label: "Blog", enabled: false },
];

/** Canonical customer booking entry (proxy redirects unauthenticated users to sign-in). */
export function marketingBookPath(serviceSlug?: ServiceSlug): string {
  return serviceSlug ? `/customer/book/${serviceSlug}` : BOOKING_PATH;
}

export const FAQ_SECTION = {
  eyebrow: "FAQs",
  heading: "Frequently Asked Questions",
  subtitle: "Everything you need to know before booking with Shalean.",
  helpText: "Still have questions? Our team is here to help.",
} as const;

export const FINAL_CTA_SECTION = {
  eyebrow: "Get started",
  heading: "Ready for a Cleaner Home?",
  subtitle: "Book trusted professional cleaners online in less than 2 minutes.",
  trustPoints: [
    "Same-Day Service",
    "Trusted Cleaners",
    "Satisfaction Guarantee",
    "Secure Booking",
  ] as const,
} as const;

export const FAQ_ITEMS = [
  {
    question: "How much does cleaning cost?",
    answer:
      "Pricing depends on your service type, home size, and add-ons. Regular cleaning starts from R450 for a standard home. Use our online quote widget for an instant estimate, or view full pricing for every service.",
  },
  {
    question: "Do cleaners bring supplies?",
    answer:
      "Yes. Shalean cleaners arrive with professional-grade, eco-friendly products and equipment. For regular cleaning you can also choose to use your own supplies if you prefer.",
  },
  {
    question: "Can I book same-day cleaning?",
    answer:
      "Same-day slots are available in many Cape Town areas subject to cleaner availability. Book online and select today's date, and we'll confirm your slot immediately.",
  },
  {
    question: "What areas in Cape Town do you cover?",
    answer:
      "We serve Sea Point, Claremont, Camps Bay, Century City, Bellville, Durbanville, Table View, Observatory, Rondebosch, Wynberg, Green Point, Milnerton, and surrounding suburbs. Contact us if your area is not listed.",
  },
  {
    question: "How do I book deep cleaning in Cape Town?",
    answer:
      "Choose Deep Cleaning in the quote widget or booking flow, select your home size, and get an instant estimate. Deep cleans include intensive kitchen, bathroom, and living-area attention, ideal before events or seasonal refreshes.",
  },
] as const;

export const MARKETING_IMAGES = {
  logo: "/marketing/shalean-logo.png",
  logoAlt: "Shalean Cleaning Services",
  hero: "/marketing/hero-kitchen.png",
  heroAlt:
    "Shalean cleaning professionals in blue uniforms cleaning a modern Cape Town kitchen",
  beforeAfterBefore:
    "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=1200&q=85",
  beforeAfterAfter:
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=85",
  pricingLifestyle:
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=1200&q=85",
  capeTownAerial:
    "https://images.unsplash.com/photo-1770988966522-4eea7f83dbe9?w=1200&q=85",
  finalCta:
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1200&q=85",
  finalCtaAlt: "Professional Shalean cleaner in a bright, modern home",
} as const;
