import {
  areaLocationPath,
  BOOKING_PATH,
  CAPE_TOWN_AREAS,
  APPLY_PATH,
  HOMEPAGE_LOCAL_SEO,
  MARKETING_SERVICES,
  REVIEWS_SECTION,
  STATS,
} from "./constants";
import {
  ABOUT_PAGE_PATH,
  CONTACT_PAGE_PATH,
  PRICING_PAGE_PATH,
  SERVICES_HUB_PATH,
} from "./marketing-routes";

export { ABOUT_PAGE_PATH };

export const ABOUT_PAGE_META = {
  title: "About Shalean | Cape Town Home Services Platform",
  description:
    "Shalean is Cape Town's modern home services platform. vetted cleaners, recurring scheduling, dispatch operations, and trusted cleaning for homes, Airbnb hosts, and offices.",
  keywords: [
    "Shalean Cleaning Services",
    "Cape Town cleaning services",
    "professional recurring home cleaning",
    "modern cleaning platform Cape Town",
    "home services platform",
  ],
} as const;

export const ABOUT_PAGE_HERO = {
  eyebrow: "About Shalean",
  h1: "Modern home services built for Cape Town.",
  intro:
    "Shalean brings together trusted cleaners, local operations, and modern booking technology to make home care simpler and more reliable across Cape Town.",
  trustLine: "Vetted cleaners · dispatch operations · secure online booking",
  image: MARKETING_SERVICES.find((s) => s.slug === "regular-cleaning")!.image,
  imageAlt: "Professional home cleaning team in Cape Town",
} as const;

export const ABOUT_PAGE_MISSION = {
  quote: "We believe a well-run home creates more time for living.",
  attribution: "Shalean. Cape Town home services",
} as const;

export const ABOUT_PAGE_OPERATIONS = {
  eyebrow: "Operational platform",
  title: "Built like a modern operating system. not a brochure",
  subtitle:
    "Shalean combines marketplace trust with real operations: vetting, dispatch, recurring engines, and customer support behind every booking.",
  cards: [
    {
      id: "vetted",
      title: "Vetted cleaner network",
      description:
        "Background-checked professionals matched to your service type, area, and schedule. not random gig assignments.",
    },
    {
      id: "dispatch",
      title: "Dispatch & coordination",
      description:
        "Jobs are offered, accepted, and monitored through operational workflows. so arrivals, handovers, and support stay on track.",
    },
    {
      id: "recurring",
      title: "Recurring scheduling",
      description:
        "Weekly, bi-weekly, and monthly home care with pay-per-visit flexibility. managed from your account, not paper calendars.",
    },
    {
      id: "support",
      title: "Customer support",
      description:
        "Mon–Sat support for booking changes, escalations, and service questions. by phone, email, and WhatsApp.",
    },
    {
      id: "booking",
      title: "Intelligent booking",
      description:
        "Instant quotes, scope clarity, and encrypted checkout before the day. transparent Cape Town pricing upfront.",
    },
    {
      id: "coverage",
      title: "Cape Town metro coverage",
      description:
        "Homes, Airbnb properties, offices, and property managers across Sea Point, Claremont, Camps Bay, Century City, and beyond.",
    },
  ],
} as const;

export const ABOUT_PAGE_HOW_IT_WORKS = {
  eyebrow: "How Shalean works",
  title: "From booking to recurring care",
  subtitle:
    "A clear, repeatable journey. whether you need a one-off deep clean or ongoing home maintenance.",
  steps: [
    {
      step: 1,
      title: "Book online",
      description: "Choose your service, see scope and pricing, and confirm securely in minutes.",
    },
    {
      step: 2,
      title: "Cleaner matching",
      description: "Eligible vetted cleaners in your area are matched to your job type and timing.",
    },
    {
      step: 3,
      title: "Arrival coordination",
      description: "Dispatch and support keep handovers on schedule. especially for hosts and offices.",
    },
    {
      step: 4,
      title: "Quality delivery",
      description: "Structured checklists, insured teams, and satisfaction standards on every visit.",
    },
    {
      step: 5,
      title: "Recurring support",
      description: "Manage upcoming visits, pauses, and changes from your account. pay per visit, no lock-in.",
    },
  ],
} as const;

export const ABOUT_PAGE_LOCAL = {
  eyebrow: "Cape Town authority",
  title: "Local operations across the metro",
  subtitle: HOMEPAGE_LOCAL_SEO.paragraphs[1],
  featuredAreas: CAPE_TOWN_AREAS,
  audienceNote:
    "We serve families, Airbnb hosts, property managers, offices, and recurring households. with suburb pages and transparent pricing for every service type.",
} as const;

export const ABOUT_PAGE_TRUST_SAFETY = {
  eyebrow: "Trust & safety",
  title: "Operational trust you can verify",
  subtitle: "The same standards behind our dashboards and dispatch. visible to every customer.",
  items: [
    {
      id: "verification",
      title: "Cleaner verification",
      description: "Background checks and onboarding before cleaners join the Shalean network.",
    },
    {
      id: "escalation",
      title: "Support escalation",
      description: "Clear paths to resolve issues. from booking changes to service follow-ups.",
    },
    {
      id: "monitoring",
      title: "Operational monitoring",
      description: "Assignment, payment, and visit status tracked through platform operations.",
    },
    {
      id: "payments",
      title: "Secure payments",
      description: "Encrypted online checkout with confirmed booking details before your clean.",
    },
  ],
} as const;

export const ABOUT_PAGE_SOCIAL_PROOF = {
  eyebrow: "Social proof",
  title: "Trusted by Cape Town customers",
  subtitle: REVIEWS_SECTION.subtitle,
  stats: STATS,
  ratingLabel: REVIEWS_SECTION.ratingLabel,
  reviewCountLabel: REVIEWS_SECTION.reviewCountLabel,
} as const;

export const ABOUT_PAGE_WHO_WE_SERVE = {
  eyebrow: "Who we serve",
  title: "One platform, many Cape Town needs",
  cards: [
    {
      id: "homes",
      title: "Homes",
      description: "Regular upkeep, deep refreshes, and flexible one-off cleans for busy households.",
    },
    {
      id: "airbnb",
      title: "Airbnb hosts",
      description: "Guest-ready turnovers with checklist discipline and tight check-in windows.",
    },
    {
      id: "offices",
      title: "Offices",
      description: "Workspace cleaning with scope clarity and schedules that fit your team.",
    },
    {
      id: "managers",
      title: "Property managers",
      description: "Handover-ready move cleans and reliable turnaround between tenants.",
    },
    {
      id: "families",
      title: "Families",
      description: "Recurring care that fits school runs, weekends, and pay-per-visit flexibility.",
    },
    {
      id: "recurring",
      title: "Recurring clients",
      description: "Weekly, bi-weekly, or monthly visits managed online. no subscription lock-in.",
    },
  ],
} as const;

export const ABOUT_PAGE_CAREERS = {
  eyebrow: "Cleaners & careers",
  title: "Join Cape Town's vetted cleaning network",
  paragraphs: [
    "Shalean offers flexible work across the metro. reliable job offers, clear scope, and earnings tied to completed visits.",
    "Apply to join our network if you are a professional cleaner looking for consistent opportunities without building your own client pipeline from scratch.",
  ],
  ctaLabel: "Apply to clean with Shalean",
  ctaHref: APPLY_PATH,
} as const;

export const ABOUT_PAGE_FINAL_CTA = {
  title: "Ready to simplify home cleaning in Cape Town?",
  subtitle: "Book online, explore services, or compare transparent pricing. in minutes.",
  book: { label: "Book now", href: BOOKING_PATH },
  pricing: { label: "View pricing", href: PRICING_PAGE_PATH },
  services: { label: "Explore services", href: SERVICES_HUB_PATH },
} as const;

export const ABOUT_PAGE_FAQ = [
  {
    question: "Is Shalean a cleaning company or a platform?",
    answer:
      "Shalean is Cape Town's modern home services platform. we connect customers with vetted, insured cleaning professionals, backed by booking technology, dispatch operations, recurring scheduling, and customer support.",
  },
  {
    question: "How is Shalean different from a traditional cleaning agency?",
    answer:
      "You get upfront online pricing, secure payments, operational dispatch, and account-based recurring management. not phone quotes, cash handling, or opaque scheduling.",
  },
  {
    question: "Does Shalean offer recurring home cleaning in Cape Town?",
    answer:
      "Yes. Choose weekly, bi-weekly, monthly, or multi-day schedules. Each visit is booked and paid individually with pay-per-visit flexibility and no subscription lock-in.",
  },
  {
    question: "Which areas of Cape Town does Shalean serve?",
    answer:
      "We operate across the Cape Town metro including Sea Point, Claremont, Camps Bay, Century City, Bellville, Durbanville, and surrounding suburbs. Browse our locations hub for suburb-specific pages.",
  },
  {
    question: "How do I become a Shalean cleaner?",
    answer:
      "Professional cleaners can apply through our cleaner onboarding flow. We look for reliability, quality standards, and Cape Town availability before adding you to the vetted network.",
  },
] as const;

export const ABOUT_PAGE_INTERNAL_LINKS = {
  services: { label: "All cleaning services", href: SERVICES_HUB_PATH },
  pricing: { label: "Cleaning prices Cape Town", href: PRICING_PAGE_PATH },
  locations: { label: "Cape Town service areas", href: "/locations" },
  reviews: { label: "Customer reviews", href: "/reviews" },
  contact: { label: "Contact Shalean", href: CONTACT_PAGE_PATH },
} as const;

export function aboutAreaHref(area: string): string {
  return areaLocationPath(area);
}
