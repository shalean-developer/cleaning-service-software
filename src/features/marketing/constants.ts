import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";
import type { ServiceSlug } from "@/features/pricing/server/types";

export const BRAND = {
  primary: "#2563EB",
  navy: "#0F172A",
  softBlue: "#DBEAFE",
  sky: "#38BDF8",
  white: "#FFFFFF",
  bg: "#F8FAFC",
  border: "#E2E8F0",
} as const;

export const SHALEAN_CONTACT = {
  phoneE164: "+27211234567",
  phoneDisplay: "021 123 4567",
  whatsappNumber: "27211234567",
  email: "hello@shalean.co.za",
  address: "Cape Town, Western Cape, South Africa",
} as const;

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "#services", label: "Services", children: ["Regular Cleaning", "Deep Cleaning", "Airbnb Cleaning", "Office Cleaning"] },
  { href: "#pricing", label: "Pricing" },
  { href: "#areas", label: "Locations", children: ["Sea Point", "Claremont", "Camps Bay", "Durbanville"] },
  { href: "#about", label: "About Us" },
  { href: "#blog", label: "Blog" },
  { href: "#contact", label: "Contact" },
] as const;

export const FOOTER_QUICK_LINKS = [
  { href: "#about", label: "About Us" },
  { href: "#pricing", label: "Pricing" },
  { href: "#areas", label: "Locations" },
  { href: "#blog", label: "Blog" },
  { href: "#contact", label: "Careers" },
  { href: "#contact", label: "Contact" },
] as const;

export const FOOTER_SUPPORT_LINKS = [
  { href: "#faq", label: "FAQ" },
  { href: "#", label: "Terms & Conditions" },
  { href: "#", label: "Privacy Policy" },
  { href: "#", label: "Refund Policy" },
] as const;

export const BUSINESS_HOURS = "Mon – Sat: 7:00 AM – 7:00 PM";

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

export const HERO_TRUST_ITEMS = [
  { id: "vetted", label: "Background Checked", icon: "shield" as const },
  { id: "same-day", label: "Same-Day Availability", icon: "clock" as const },
  { id: "eco", label: "Eco-Friendly Products", icon: "leaf" as const },
  { id: "guarantee", label: "Satisfaction Guarantee", icon: "sparkle" as const },
] as const;

export const STATS = [
  { value: "5,000+", label: "Homes Cleaned", icon: "home" as const },
  { value: "150+", label: "Professional Cleaners", icon: "users" as const },
  { value: "4.9★", label: "Average Rating", icon: "star" as const },
] as const;

export type MarketingServiceCard = {
  slug: ServiceSlug;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
};

export const MARKETING_SERVICES: MarketingServiceCard[] = [
  {
    slug: "regular-cleaning",
    title: "Regular Cleaning",
    description:
      "Routine cleaning for kitchens, bathrooms, and living spaces — perfect for busy households.",
    image:
      "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?w=800&q=80",
    imageAlt: "Regular home cleaning in a modern kitchen",
  },
  {
    slug: "deep-cleaning",
    title: "Deep Cleaning",
    description:
      "Intensive top-to-bottom clean for seasonal refreshes, spring cleans, and neglected areas.",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    imageAlt: "Deep cleaning service detail",
  },
  {
    slug: "moving-cleaning",
    title: "Move In/Out Cleaning",
    description:
      "Handover-ready cleaning for tenants, landlords, and property managers across Cape Town.",
    image:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
    imageAlt: "Empty apartment ready after move-out cleaning",
  },
  {
    slug: "airbnb-cleaning",
    title: "Airbnb Cleaning",
    description:
      "Fast turnover cleans between guests with checklist-ready attention to detail.",
    image:
      "https://images.unsplash.com/photo-1560448204-e02f11c45751?w=800&q=80",
    imageAlt: "Short-term rental property cleaning",
  },
  {
    slug: "office-cleaning",
    title: "Office Cleaning",
    description:
      "Professional workspace cleaning tailored to offices, studios, and shared workspaces.",
    image:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800&q=80",
    imageAlt: "Modern office space cleaning",
  },
  {
    slug: "carpet-cleaning",
    title: "Carpet Cleaning",
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
    title: "Enjoy Your Clean Home",
    description: "Relax and enjoy a spotless home or office.",
  },
] as const;

export const WHY_CHOOSE = [
  { id: "vetted", title: "Vetted Cleaners", description: "Background checked\nand trained." },
  { id: "insured", title: "Insured Service", description: "Full professional coverage." },
  { id: "eco", title: "Eco-Friendly", description: "Safe products for your home." },
  { id: "payments", title: "Secure Payments", description: "Encrypted online checkout." },
  { id: "flexible", title: "Flexible Scheduling", description: "One-off or recurring bookings." },
  { id: "guarantee", title: "Satisfaction Guarantee", description: "We stand behind every clean." },
] as const;

export const REVIEWS = [
  {
    name: "Thandi M.",
    suburb: "Sea Point",
    rating: 5,
    text: "Booking was effortless and our apartment looked brand new. The team was punctual, friendly, and thorough.",
    image:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
  },
  {
    name: "James K.",
    suburb: "Claremont",
    rating: 5,
    text: "We use Shalean for our Airbnb turnovers. Consistent quality every time — guests always comment on how clean the place is.",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
  },
  {
    name: "Sarah L.",
    suburb: "Durbanville",
    rating: 5,
    text: "Deep clean before moving in was exceptional. Transparent pricing and no surprises on the day.",
    image:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80",
  },
  {
    name: "David P.",
    suburb: "Camps Bay",
    rating: 5,
    text: "Same-day booking saved us before guests arrived. Professional, insured, and worth every rand.",
    image:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
  },
] as const;

/** Homepage pricing card — same four services as MARKETING_SERVICES_HOMEPAGE. */
export const PRICING_PREVIEW = HOMEPAGE_SERVICE_SLUGS.map((slug) => ({
  slug,
  name: SERVICE_CATALOG[slug].label,
  fromPrice: formatZarFromCents(SERVICE_CATALOG[slug].baseCents),
}));

export const CAPE_TOWN_AREAS = [
  "Sea Point",
  "Claremont",
  "Camps Bay",
  "Century City",
  "Bellville",
  "Durbanville",
  "Table View",
  "Observatory",
  "Rondebosch",
  "Wynberg",
  "Green Point",
  "Milnerton",
] as const;

export const BOOKING_PATH = "/sign-up?redirectedFrom=/customer/book" as const;

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
      "Same-day slots are available in many Cape Town areas subject to cleaner availability. Book online and select today's date — we'll confirm your slot immediately.",
  },
] as const;

export const MARKETING_IMAGES = {
  hero: "/marketing/hero-kitchen.png",
  heroAlt:
    "Shalean cleaning professionals in blue uniforms cleaning a modern Cape Town kitchen",
  beforeAfterBefore:
    "https://images.unsplash.com/photo-1556911220-bff31c812dba?w=900&q=80",
  beforeAfterAfter:
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=900&q=80",
  pricingLifestyle:
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80",
  capeTownAerial:
    "https://images.unsplash.com/photo-1770988966522-4eea7f83dbe9?w=900&q=80",
  finalCta:
    "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&q=80",
} as const;
