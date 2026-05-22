import type { ServiceSlug } from "@/features/pricing/server/types";

/** Labels aligned with SERVICE_CATALOG. safe for client form UI. */
export const CLEANER_CAPABILITY_OPTIONS: { slug: ServiceSlug; label: string }[] = [
  { slug: "regular-cleaning", label: "Regular Cleaning" },
  { slug: "deep-cleaning", label: "Deep Cleaning" },
  { slug: "moving-cleaning", label: "Moving Cleaning" },
  { slug: "airbnb-cleaning", label: "Airbnb Cleaning" },
  { slug: "office-cleaning", label: "Office Cleaning" },
  { slug: "carpet-cleaning", label: "Carpet Cleaning" },
];
