import { isServiceSlug } from "@/features/pricing/server/catalog";
import type { ServiceSlug } from "@/features/pricing/server/types";
import { WIZARD_SERVICE_OPTIONS } from "./constants";

/** Validates a `/customer/book/:serviceSlug` segment for the booking wizard. */
export function resolveBookPageServiceSlug(param: string): ServiceSlug | null {
  if (!isServiceSlug(param)) return null;
  const option = WIZARD_SERVICE_OPTIONS.find((s) => s.slug === param);
  if (!option?.enabled) return null;
  return param;
}

export function customerBookServicePath(slug: ServiceSlug): string {
  return `/customer/book/${slug}`;
}
