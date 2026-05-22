import type { ServiceSlug } from "@/features/pricing/server/types";

/** Services where customers may choose preferred visit cadence in the wizard UI. */
const FREQUENCY_VISIBLE_SERVICE_SLUGS = new Set<ServiceSlug>([
  "regular-cleaning",
  "airbnb-cleaning",
  "office-cleaning",
]);

/**
 * Whether the booking wizard should show visit-frequency controls and cadence copy.
 * Does not change pricing input defaults. hidden services still send `frequency` in state/payloads.
 */
export function showFrequencyForService(
  serviceSlug: ServiceSlug | string | null | undefined,
): boolean {
  if (!serviceSlug) return false;
  return FREQUENCY_VISIBLE_SERVICE_SLUGS.has(serviceSlug as ServiceSlug);
}
