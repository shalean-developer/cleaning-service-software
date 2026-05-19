import type { CleanerEligibilityCode } from "@/features/cleaners/server/types";
import type { CleanerPublicCard } from "@/features/cleaners/server/types";

/** How many cleaners show before “View all” (presentation only). */
export const CLEANER_LIST_INITIAL_VISIBLE = 5;

const SHORT_INELIGIBLE_REASON: Partial<Record<CleanerEligibilityCode, string>> = {
  inactive: "Not active",
  suspended: "Suspended",
  no_service_capability: "Wrong service type",
  outside_service_area: "Outside your area",
  outside_availability_window: "Outside usual hours",
  time_off: "On time off",
  schedule_conflict: "Booked at this time",
};

/** One-line card subtitle — does not change eligibility rules. */
export function cleanerCardSubtitle(card: CleanerPublicCard): string {
  if (card.eligibilityStatus !== "eligible") {
    return (
      SHORT_INELIGIBLE_REASON[card.eligibilityCode ?? "inactive"] ??
      "Not available for this slot"
    );
  }

  if (card.availabilitySummary.trim()) {
    return card.availabilitySummary.trim();
  }

  return "Available for your time slot";
}

/** Shorter experience/area hint when present (eligible only). */
export function cleanerCardExperienceHint(card: CleanerPublicCard): string | null {
  if (card.eligibilityStatus !== "eligible") return null;
  const areas = card.serviceAreasSummary.trim();
  if (!areas) return null;
  return areas.length > 48 ? `${areas.slice(0, 45)}…` : areas;
}

export function cleanerCardAriaLabel(card: CleanerPublicCard): string {
  const rating = card.rating != null ? `, rating ${card.rating.toFixed(1)}` : "";
  return `${card.displayName}${rating}. ${card.eligibilityReason}`;
}
