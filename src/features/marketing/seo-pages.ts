import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";
import type { ServiceSlug } from "@/features/pricing/server/types";
import {
  CAPE_TOWN_AREAS,
  FAQ_ITEMS,
  MARKETING_SERVICES,
  SERVICE_SEO_PATHS,
  areaLocationPath,
  formatZarFromCents,
  serviceFromPrice,
} from "./constants";
import { locationSlugFromArea, type LocationSeoSlug } from "./marketing-routes";

export {
  ABOUT_PAGE_PATH,
  CONTACT_PAGE_PATH,
  FAQ_PAGE_PATH,
  LOCATION_SEO_SLUGS,
  LOCATIONS_HUB_PATH,
  PRICING_PAGE_PATH,
  REVIEWS_PAGE_PATH,
  SERVICES_HUB_PATH,
  locationSlugFromArea,
} from "./marketing-routes";

/** FAQ preview on the services hub (links to full FAQ page). */
export const SERVICES_HUB_FAQ_PREVIEW = [
  {
    question: "Which cleaning service should I choose?",
    answer:
      "Choose regular cleaning for ongoing upkeep, deep cleaning for intensive refreshes, move-in/out for handovers, Airbnb cleaning for guest turnovers, office cleaning for workspaces, and carpet cleaning for rugs and upholstery. Each service page explains scope and pricing.",
  },
  {
    question: "What is the difference between regular and deep cleaning?",
    answer:
      "Regular cleaning maintains day-to-day freshness on kitchens, bathrooms, and living areas. Deep cleaning is more intensive — ideal for seasonal refreshes, neglected spaces, or before events. Compare both on our Cape Town cleaning prices page.",
  },
  {
    question: "Do cleaners bring equipment and supplies?",
    answer:
      "Yes. Shalean cleaners typically arrive with professional-grade, eco-friendly products and equipment. For regular cleaning you can opt to use your own supplies when booking if you prefer.",
  },
  {
    question: "How does recurring cleaning work?",
    answer:
      "Select weekly, bi-weekly, monthly, or multi-day schedules for regular home cleaning. Each visit is paid individually — pay per visit with no subscription lock-in. Future visits are booked and paid separately from your account.",
  },
  {
    question: "How do Airbnb turnovers work?",
    answer:
      "Choose Airbnb Cleaning when booking, share your checklist, and align turnover times with check-in and check-out. Linen resets, bathroom refreshes, and guest-ready finishing are included in the service scope.",
  },
  {
    question: "Which Cape Town areas do you serve?",
    answer:
      "We cover Sea Point, Claremont, Camps Bay, Century City, Bellville, Durbanville, Table View, Rondebosch, and suburbs across the metro. Browse suburb pages or contact us if your area is not listed.",
  },
] as const;

/** URL segment after `/services/` (e.g. regular-cleaning-cape-town). */
export type ServiceSeoSlug = (typeof SERVICE_SEO_SLUGS)[number];

export const SERVICE_SEO_SLUGS = [
  "regular-cleaning-cape-town",
  "deep-cleaning-cape-town",
  "move-in-out-cleaning-cape-town",
  "airbnb-cleaning-cape-town",
  "office-cleaning-cape-town",
  "carpet-cleaning-cape-town",
] as const;

const SEO_SLUG_TO_SERVICE: Record<ServiceSeoSlug, ServiceSlug> = {
  "regular-cleaning-cape-town": "regular-cleaning",
  "deep-cleaning-cape-town": "deep-cleaning",
  "move-in-out-cleaning-cape-town": "moving-cleaning",
  "airbnb-cleaning-cape-town": "airbnb-cleaning",
  "office-cleaning-cape-town": "office-cleaning",
  "carpet-cleaning-cape-town": "carpet-cleaning",
};

export function isServiceSeoSlug(slug: string): slug is ServiceSeoSlug {
  return (SERVICE_SEO_SLUGS as readonly string[]).includes(slug);
}

export function serviceSlugFromSeoSlug(seoSlug: ServiceSeoSlug): ServiceSlug {
  return SEO_SLUG_TO_SERVICE[seoSlug];
}

export function seoSlugFromServiceSlug(serviceSlug: ServiceSlug): ServiceSeoSlug {
  const path = SERVICE_SEO_PATHS[serviceSlug];
  return path.replace("/services/", "") as ServiceSeoSlug;
}

export type ServiceSeoContent = {
  seoSlug: ServiceSeoSlug;
  serviceSlug: ServiceSlug;
  path: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  sections: { heading: string; body: string }[];
  relatedSlugs: ServiceSeoSlug[];
};

function serviceCard(slug: ServiceSlug) {
  return MARKETING_SERVICES.find((s) => s.slug === slug)!;
}

function buildServiceContent(
  seoSlug: ServiceSeoSlug,
  serviceSlug: ServiceSlug,
  metaTitle: string,
  metaDescription: string,
  h1: string,
  intro: string,
  sections: { heading: string; body: string }[],
  relatedSlugs: ServiceSeoSlug[],
): ServiceSeoContent {
  const card = serviceCard(serviceSlug);
  return {
    seoSlug,
    serviceSlug,
    path: SERVICE_SEO_PATHS[serviceSlug],
    title: card.title,
    metaTitle,
    metaDescription,
    h1,
    intro,
    sections,
    relatedSlugs,
  };
}

export const SERVICE_SEO_CONTENT: Record<ServiceSeoSlug, ServiceSeoContent> = {
  "regular-cleaning-cape-town": buildServiceContent(
    "regular-cleaning-cape-town",
    "regular-cleaning",
    "Regular Home Cleaning Cape Town | Shalean",
    "Book vetted regular home cleaning in Cape Town. Transparent pricing from R450, insured cleaners, and online booking in minutes.",
    "Regular Home Cleaning in Cape Town",
    "Keep your home consistently fresh with Shalean's regular cleaning service. Our vetted, insured cleaners follow a structured checklist for kitchens, bathrooms, bedrooms, and living areas — ideal for busy households across Cape Town.",
    [
      {
        heading: "What's included",
        body: "Standard regular cleans cover dusting, vacuuming, mopping, bathroom sanitising, kitchen surfaces, and tidy-up of main living spaces. Add bedrooms, bathrooms, or extra rooms in the booking flow for an accurate quote.",
      },
      {
        heading: "Pricing in Cape Town",
        body: `Regular cleaning starts from ${serviceFromPrice("regular-cleaning")} for a standard home. Final pricing depends on home size, frequency, and add-ons. View our full cleaning prices page or get an instant quote when you book online.`,
      },
      {
        heading: "Why book with Shalean",
        body: "Background-checked cleaners, secure online payments, eco-friendly products, and flexible one-off or recurring schedules. Same-day slots are often available in Sea Point, Claremont, Camps Bay, and surrounding suburbs.",
      },
    ],
    ["deep-cleaning-cape-town", "airbnb-cleaning-cape-town", "office-cleaning-cape-town"],
  ),
  "deep-cleaning-cape-town": buildServiceContent(
    "deep-cleaning-cape-town",
    "deep-cleaning",
    "Deep Cleaning Services Cape Town | Shalean",
    "Intensive deep cleaning in Cape Town for kitchens, bathrooms, and neglected areas. Insured professionals, transparent pricing from R850.",
    "Deep Cleaning Services in Cape Town",
    "A Shalean deep clean goes beyond routine housekeeping — ideal before events, seasonal refreshes, or when your home needs extra attention. Our teams focus on buildup, corners, and high-touch areas across Cape Town.",
    [
      {
        heading: "When to choose deep cleaning",
        body: "Book a deep clean when moving between tenants, after renovations, before hosting guests, or when regular maintenance is not enough. Many customers pair a deep clean with ongoing regular cleaning.",
      },
      {
        heading: "Pricing",
        body: `Deep cleaning starts from ${serviceFromPrice("deep-cleaning")}. Scope depends on bedrooms, bathrooms, and property condition. See our Cape Town cleaning prices for all services.`,
      },
      {
        heading: "Areas we serve",
        body: "We operate across the Cape Town metro including Sea Point, Durbanville, Century City, Observatory, and more. Select your suburb when booking for accurate scheduling.",
      },
    ],
    ["regular-cleaning-cape-town", "move-in-out-cleaning-cape-town", "carpet-cleaning-cape-town"],
  ),
  "move-in-out-cleaning-cape-town": buildServiceContent(
    "move-in-out-cleaning-cape-town",
    "moving-cleaning",
    "Move In / Move Out Cleaning Cape Town | Shalean",
    "Handover-ready move in and move out cleaning in Cape Town for tenants and landlords. Transparent pricing from R1,200.",
    "Move In / Move Out Cleaning in Cape Town",
    "Moving is stressful enough — Shalean delivers handover-ready cleaning for empty or furnished properties so you can meet landlord, agent, or buyer expectations across Cape Town.",
    [
      {
        heading: "Who it's for",
        body: "Tenants leaving a rental, landlords preparing a unit, property managers between leases, and buyers who want a sanitised home before move-in.",
      },
      {
        heading: "What's covered",
        body: "Kitchen appliances (exterior), cupboards, bathrooms, floors, windows (reachable), and all main rooms. Add carpet or deep scope in the booking flow if needed.",
      },
      {
        heading: "Pricing",
        body: `Move in/out cleaning starts from ${serviceFromPrice("moving-cleaning")}. Property size and condition affect the final quote — book online for an instant estimate.`,
      },
    ],
    ["deep-cleaning-cape-town", "regular-cleaning-cape-town", "carpet-cleaning-cape-town"],
  ),
  "airbnb-cleaning-cape-town": buildServiceContent(
    "airbnb-cleaning-cape-town",
    "airbnb-cleaning",
    "Airbnb Cleaning Cape Town | Shalean",
    "Fast Airbnb and short-term rental turnovers in Cape Town. Checklist-ready cleans between guests with reliable scheduling.",
    "Airbnb & Short-Term Rental Cleaning in Cape Town",
    "Hosts across Cape Town trust Shalean for consistent turnovers between guests. We work to your checklist, restock where agreed, and help you maintain five-star cleanliness standards.",
    [
      {
        heading: "Turnover cleaning",
        body: "Linens change (where supplied), bathroom reset, kitchen wipe-down, floors, and guest-ready finishing touches. Book recurring slots or ad-hoc turnovers before check-in.",
      },
      {
        heading: "Pricing",
        body: `Airbnb cleaning starts from ${serviceFromPrice("airbnb-cleaning")}. Pricing reflects bedrooms, bathrooms, and turnaround urgency.`,
      },
      {
        heading: "Popular host areas",
        body: "Sea Point, Green Point, Camps Bay, Claremont, and Century City are among our busiest short-term rental zones — same-day availability subject to cleaner schedules.",
      },
    ],
    ["regular-cleaning-cape-town", "deep-cleaning-cape-town", "office-cleaning-cape-town"],
  ),
  "office-cleaning-cape-town": buildServiceContent(
    "office-cleaning-cape-town",
    "office-cleaning",
    "Office Cleaning Cape Town | Shalean",
    "Professional office and workspace cleaning in Cape Town. Flexible schedules for teams, studios, and shared spaces.",
    "Office Cleaning in Cape Town",
    "Shalean keeps Cape Town workspaces professional and hygienic — from small studios to multi-desk offices. Book after-hours or daytime cleans to suit your team.",
    [
      {
        heading: "Workspace coverage",
        body: "Desks, meeting rooms, kitchens, restrooms, reception areas, and common floors. Property size (sqm) drives pricing for larger offices.",
      },
      {
        heading: "Pricing",
        body: `Office cleaning starts from ${serviceFromPrice("office-cleaning")}. Enter your workspace size in the booking flow for an accurate quote.`,
      },
      {
        heading: "Commercial reliability",
        body: "Insured cleaners, secure payments, and recurring contracts available. Contact us for bespoke schedules across Century City, Bellville, and the CBD.",
      },
    ],
    ["regular-cleaning-cape-town", "airbnb-cleaning-cape-town", "carpet-cleaning-cape-town"],
  ),
  "carpet-cleaning-cape-town": buildServiceContent(
    "carpet-cleaning-cape-town",
    "carpet-cleaning",
    "Carpet Cleaning Cape Town | Shalean",
    "Targeted carpet and upholstery cleaning in Cape Town for high-traffic rooms. Transparent pricing from R400.",
    "Carpet Cleaning in Cape Town",
    "Refresh carpets and marked upholstery in homes and rentals across Cape Town. Shalean teams focus on high-traffic zones, stains, and odour-prone areas with professional equipment.",
    [
      {
        heading: "Ideal for",
        body: "Lounge carpets, stair runners, rental refreshes before handover, and post-event cleanup. Can be booked standalone or alongside deep or move-out cleaning.",
      },
      {
        heading: "Pricing",
        body: `Carpet cleaning starts from ${serviceFromPrice("carpet-cleaning")} per zone. Add multiple zones in the booking flow as needed.`,
      },
      {
        heading: "Combine with other services",
        body: "Many customers add carpet care to a deep clean or move-out booking for a single visit — saving time and coordination.",
      },
    ],
    ["deep-cleaning-cape-town", "move-in-out-cleaning-cape-town", "regular-cleaning-cape-town"],
  ),
};

/** Extended FAQs for dedicated FAQ page (includes homepage items). */
export const FAQ_PAGE_ITEMS = [
  ...FAQ_ITEMS,
  {
    question: "How do I pay for cleaning?",
    answer:
      "Pay securely online when you book. Shalean uses encrypted checkout — no cash handling required on the day unless arranged separately for specific accounts.",
  },
  {
    question: "What is your cancellation policy?",
    answer:
      "Cancel or reschedule from your account before the cut-off shown at booking. Late cancellations may incur a fee; contact our team on WhatsApp if you have an emergency.",
  },
  {
    question: "Do you clean Airbnb properties between guests?",
    answer:
      "Yes. Choose Airbnb Cleaning when booking, share your checklist, and select turnover times that match your check-in/check-out schedule.",
  },
] as const;

export const PRICING_PAGE_FAQS = [
  {
    question: "Are your Cape Town cleaning prices fixed?",
    answer:
      "Starting prices are shown for a standard home or workspace. Your final quote depends on bedrooms, bathrooms, property size, add-ons, and frequency. The online booking flow shows the full amount before you pay.",
  },
  {
    question: "Do you charge extra for cleaning supplies?",
    answer:
      "Regular cleaning includes an optional equipment fee when Shalean brings supplies. Deep, move, Airbnb, office, and carpet services include professional products unless you request otherwise.",
  },
  {
    question: "Is there a minimum booking fee?",
    answer:
      "Each service has a base price that covers a standard scope. Smaller jobs may still use the service minimum — your quote widget reflects this instantly.",
  },
] as const;

export type { LocationSeoSlug } from "./marketing-routes";

export function areaFromLocationSlug(slug: string): string | null {
  if (!slug.endsWith("-cape-town")) return null;
  const areaPart = slug.slice(0, -"-cape-town".length);
  const normalized = areaPart.replace(/-/g, " ");
  const match = CAPE_TOWN_AREAS.find(
    (a) => a.toLowerCase() === normalized,
  );
  return match ?? null;
}

export function isLocationSeoSlug(slug: string): boolean {
  return areaFromLocationSlug(slug) !== null;
}

export type LocationSeoContent = {
  slug: LocationSeoSlug;
  area: string;
  path: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  localNote: string;
};

const LOCATION_INTROS: Partial<Record<(typeof CAPE_TOWN_AREAS)[number], string>> = {
  "Sea Point":
    "Atlantic Seaboard apartments and family homes benefit from Shalean's regular, deep, and Airbnb turnover teams — with same-day slots often available.",
  Claremont:
    "Southern Suburbs families and students book Shalean for recurring home cleaning, deep refreshes, and move-in/out handovers near UCT and Cavendish.",
  "Camps Bay":
    "Luxury homes and holiday rentals in Camps Bay rely on Shalean for guest-ready Airbnb turnovers and premium deep cleaning before events.",
  "Century City":
    "Century City offices, townhouses, and canalside homes use Shalean for office cleaning, regular home care, and carpet refreshes.",
  Bellville:
    "Northern Suburbs households and small offices in Bellville choose Shalean for reliable scheduling and transparent online pricing.",
  Durbanville:
    "Wine-route suburbs and family estates in Durbanville book deep cleans, regular maintenance, and move-out services with insured Shalean teams.",
  "Table View":
    "Coastal homes in Table View and Bloubergstrand access Shalean for sand-aware regular cleaning and pre-guest deep cleans.",
  Observatory:
    "Observatory rentals and family homes use Shalean for affordable regular cleaning and tenant handover move-out cleans.",
  Rondebosch:
    "Rondebosch hosts and homeowners book Airbnb turnovers, study-friendly regular cleans, and deep kitchen-bathroom refreshes.",
  Wynberg:
    "Wynberg and surrounding areas get flexible one-off or recurring Shalean cleans with online quotes in minutes.",
  "Green Point":
    "Green Point apartments and Airbnb listings use Shalean for fast turnovers between guests and weekday regular cleaning.",
  Milnerton:
    "Milnerton and Table Bay homes book carpet care, regular cleaning, and office services through Shalean's online platform.",
};

export function buildLocationContent(area: (typeof CAPE_TOWN_AREAS)[number]): LocationSeoContent {
  const slug = locationSlugFromArea(area);
  const path = areaLocationPath(area);
  const localNote =
    LOCATION_INTROS[area] ??
    `Shalean provides home, deep, Airbnb, office, and carpet cleaning across ${area} and nearby Cape Town suburbs.`;

  return {
    slug,
    area,
    path,
    metaTitle: `Cleaning Services ${area} Cape Town | Shalean`,
    metaDescription: `Book trusted cleaning in ${area}, Cape Town. Regular, deep, Airbnb, office & carpet cleaning. Vetted cleaners, online booking, transparent pricing.`,
    h1: `Cleaning Services in ${area}`,
    intro: `Professional home and office cleaning in ${area}, Cape Town — booked online with vetted, insured Shalean cleaners and upfront pricing.`,
    localNote,
  };
}

export const LOCATION_SEO_CONTENT: Record<string, LocationSeoContent> =
  Object.fromEntries(
    CAPE_TOWN_AREAS.map((area) => {
      const content = buildLocationContent(area);
      return [content.slug, content];
    }),
  );

export const ALL_PRICING_ROWS = (Object.keys(SERVICE_CATALOG) as ServiceSlug[]).map(
  (slug) => ({
    slug,
    name: SERVICE_CATALOG[slug].label,
    fromPrice: formatZarFromCents(SERVICE_CATALOG[slug].baseCents),
    path: SERVICE_SEO_PATHS[slug],
  }),
);
