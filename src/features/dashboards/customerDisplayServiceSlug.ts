import { parsePaymentReturnServiceSlug as parseAirbnbPaymentReturnServiceSlug } from "@/features/dashboards/airbnbCustomerDisplay";
import { isRegularCleaningSlug } from "@/features/dashboards/regularCustomerDisplay";

/** Parses optional `service` query param from payment return URLs (all catalog slugs). */
export function parsePaymentReturnServiceSlug(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (isRegularCleaningSlug(trimmed)) return trimmed;
  return parseAirbnbPaymentReturnServiceSlug(trimmed);
}
