import type { ServiceSlug } from "@/features/pricing/server/types";

/** Services where customers may choose preferred visit cadence in the wizard UI. */
const FREQUENCY_VISIBLE_SERVICE_SLUGS = new Set<ServiceSlug>([
  "regular-cleaning",
  "airbnb-cleaning",
  "office-cleaning",
]);

/**
 * Whether the booking wizard should show visit-frequency controls and cadence copy.
 */
export function showFrequencyForService(
  serviceSlug: ServiceSlug | string | null | undefined,
): boolean {
  if (!serviceSlug) return false;
  return FREQUENCY_VISIBLE_SERVICE_SLUGS.has(serviceSlug as ServiceSlug);
}

/** Resets cadence fields when the target service does not support recurring pricing. */
export function cadenceResetPatchForService(serviceSlug: ServiceSlug | string | null | undefined): {
  frequency: "once";
  recurringDays: [];
} | null {
  if (showFrequencyForService(serviceSlug)) return null;
  return { frequency: "once", recurringDays: [] };
}

/** Server-side guard: only cadence-capable services may use non-once pricing frequencies. */
export function validateCadenceFrequencyForService(
  serviceSlug: ServiceSlug | string,
  frequency: string,
): string | null {
  if (showFrequencyForService(serviceSlug)) return null;
  if (frequency === "once") return null;
  return "This service type only supports once-off visits.";
}
