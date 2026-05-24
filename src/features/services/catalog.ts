export const CORE_SERVICE_SLUGS = [
  "standard-home-cleaning",
  "deep-cleaning",
  "move-in-move-out-cleaning",
  "office-cleaning",
  "carpet-cleaning",
  "post-construction-cleaning",
] as const;

export type CoreServiceSlug = (typeof CORE_SERVICE_SLUGS)[number];

export type CoreServiceCategory = "residential" | "commercial" | "specialist";

export type CoreServiceCatalogueItem = {
  slug: CoreServiceSlug;
  title: string;
  shortDescription: string;
  category: CoreServiceCategory;
  availableForBooking: boolean;
  displayCopy: string;
  seoPath: `/services/${string}`;
  bookingPath: `/customer/book/${string}` | null;
};

export const CORE_SERVICE_CATALOGUE: readonly CoreServiceCatalogueItem[] = [
  {
    slug: "standard-home-cleaning",
    title: "Standard Home Cleaning",
    shortDescription: "Routine cleaning for kitchens, bathrooms, bedrooms, and living spaces.",
    category: "residential",
    availableForBooking: true,
    displayCopy:
      "Book standard home cleaning in Cape Town for reliable upkeep, tidy living areas, fresh bathrooms, and a cleaner kitchen without the weekly admin.",
    seoPath: "/services/regular-cleaning-cape-town",
    bookingPath: "/customer/book/regular-cleaning",
  },
  {
    slug: "deep-cleaning",
    title: "Deep Cleaning",
    shortDescription: "A detailed top-to-bottom refresh for homes that need extra attention.",
    category: "residential",
    availableForBooking: true,
    displayCopy:
      "Deep cleaning services in Cape Town for seasonal resets, pre-event refreshes, and spaces that need a more intensive clean than routine maintenance.",
    seoPath: "/services/deep-cleaning-cape-town",
    bookingPath: "/customer/book/deep-cleaning",
  },
  {
    slug: "move-in-move-out-cleaning",
    title: "Move In / Move Out Cleaning",
    shortDescription: "Handover-ready cleaning for tenants, landlords, and property managers.",
    category: "residential",
    availableForBooking: true,
    displayCopy:
      "Move in and move out cleaning in Cape Town for rental handovers, new homes, and properties that need a fresh, inspection-ready finish.",
    seoPath: "/services/move-in-out-cleaning-cape-town",
    bookingPath: "/customer/book/moving-cleaning",
  },
  {
    slug: "office-cleaning",
    title: "Office Cleaning",
    shortDescription: "Professional cleaning for offices, studios, shared spaces, and teams.",
    category: "commercial",
    availableForBooking: true,
    displayCopy:
      "Office cleaning in Cape Town for workspaces that need reliable hygiene, tidy shared areas, and flexible schedules around business hours.",
    seoPath: "/services/office-cleaning-cape-town",
    bookingPath: "/customer/book/office-cleaning",
  },
  {
    slug: "carpet-cleaning",
    title: "Carpet Cleaning",
    shortDescription: "Targeted carpet and upholstery care for high-traffic areas.",
    category: "specialist",
    availableForBooking: true,
    displayCopy:
      "Carpet cleaning in Cape Town for high-traffic rooms, rental refreshes, marked carpets, rugs, and upholstery that need specialist attention.",
    seoPath: "/services/carpet-cleaning-cape-town",
    bookingPath: "/customer/book/carpet-cleaning",
  },
  {
    slug: "post-construction-cleaning",
    title: "Post Construction Cleaning",
    shortDescription: "Builder dust, debris, and residue cleanup for newly finished spaces.",
    category: "specialist",
    availableForBooking: false,
    displayCopy:
      "Post construction cleaning in Cape Town for renovated homes, new offices, and completed build sites that need careful dust and residue removal before handover.",
    seoPath: "/services/post-construction-cleaning-cape-town",
    bookingPath: null,
  },
] as const;

export const CORE_SERVICE_CATALOGUE_BY_SLUG = Object.fromEntries(
  CORE_SERVICE_CATALOGUE.map((service) => [service.slug, service]),
) as Record<CoreServiceSlug, CoreServiceCatalogueItem>;

export function getCoreServiceBySlug(
  slug: string,
): CoreServiceCatalogueItem | null {
  return CORE_SERVICE_SLUGS.includes(slug as CoreServiceSlug)
    ? CORE_SERVICE_CATALOGUE_BY_SLUG[slug as CoreServiceSlug]
    : null;
}

export const BOOKABLE_CORE_SERVICES = CORE_SERVICE_CATALOGUE.filter(
  (service) => service.availableForBooking,
);
