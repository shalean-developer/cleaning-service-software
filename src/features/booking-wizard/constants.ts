import { SERVICE_CATALOG } from "@/features/pricing/server/catalog";
import type { ServiceSlug } from "@/features/pricing/server/types";

export const WIZARD_TIMEZONE = "Africa/Johannesburg";
export const WIZARD_JOB_DURATION_MINUTES = 180;
export const WIZARD_STORAGE_KEY = "shalean-booking-wizard-v1";

export type WizardServiceOption = {
  slug: ServiceSlug;
  label: string;
  description: string;
  enabled: boolean;
};

export const WIZARD_SERVICE_OPTIONS: WizardServiceOption[] = (
  [
    "regular-cleaning",
    "deep-cleaning",
    "moving-cleaning",
    "airbnb-cleaning",
    "office-cleaning",
    "carpet-cleaning",
  ] as const
).map((slug) => ({
  slug,
  label: SERVICE_CATALOG[slug].label,
  description:
    slug === "office-cleaning"
      ? "Commercial spaces — property size may apply"
      : slug === "carpet-cleaning"
        ? "Carpet zones per room"
        : "Professional home cleaning",
  enabled: true,
}));

export const WIZARD_STEP_LABELS: Record<string, string> = {
  service: "Service",
  datetime: "Date & time",
  location: "Location",
  details: "Details",
  cleaner: "Cleaner",
  review: "Review",
  checkout: "Checkout",
};
