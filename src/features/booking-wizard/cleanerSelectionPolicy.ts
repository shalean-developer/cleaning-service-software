import type { CleanerPublicCard } from "@/features/cleaners/server/types";
import type { ServiceSlug } from "@/features/pricing/server/types";

export type CleanerSelectionMode = "team_only" | "cleaner_with_team_option";

const TEAM_ONLY_SLUGS: readonly ServiceSlug[] = ["deep-cleaning", "moving-cleaning"];

const CLEANER_WITH_TEAM_OPTION_SLUGS: readonly ServiceSlug[] = [
  "regular-cleaning",
  "airbnb-cleaning",
  "office-cleaning",
  "carpet-cleaning",
];

export function getCleanerSelectionMode(
  serviceSlug: ServiceSlug | null,
): CleanerSelectionMode {
  if (serviceSlug && (TEAM_ONLY_SLUGS as readonly string[]).includes(serviceSlug)) {
    return "team_only";
  }
  return "cleaner_with_team_option";
}

/** Presentation-only: eligible cleaners from API data (does not change eligibility rules). */
export function filterDisplayableCleaners(
  cleaners: CleanerPublicCard[],
): CleanerPublicCard[] {
  return cleaners.filter((card) => card.eligibilityStatus === "eligible");
}

export type TeamOptionCopy = {
  title: string;
  description: string;
  recommendedBadge: boolean;
};

export function getTeamOptionCopy(mode: CleanerSelectionMode): TeamOptionCopy {
  if (mode === "team_only") {
    return {
      title: "Shalean team",
      description:
        "This service is handled by a Shalean team for larger or detailed jobs.",
      recommendedBadge: true,
    };
  }
  return {
    title: "Prefer a team",
    description: "We'll assign a suitable team for faster or larger jobs.",
    recommendedBadge: false,
  };
}

export const NO_INDIVIDUAL_CLEANERS_EMPTY_STATE =
  "No individual cleaners available for this slot. We'll assign the best available team.";

export function showsIndividualCleanerList(mode: CleanerSelectionMode): boolean {
  return mode === "cleaner_with_team_option";
}
