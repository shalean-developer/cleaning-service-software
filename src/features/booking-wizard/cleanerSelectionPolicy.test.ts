import { describe, expect, it } from "vitest";
import type { CleanerPublicCard } from "@/features/cleaners/server/types";
import {
  filterDisplayableCleaners,
  getCleanerSelectionMode,
  getTeamOptionCopy,
  NO_INDIVIDUAL_CLEANERS_EMPTY_STATE,
  showsIndividualCleanerList,
} from "./cleanerSelectionPolicy";

function card(overrides: Partial<CleanerPublicCard> = {}): CleanerPublicCard {
  return {
    cleanerId: "c1",
    displayName: "Sam N.",
    rating: 4.8,
    serviceAreasSummary: "Northern suburbs",
    availabilitySummary: "Mon–Fri mornings",
    eligibilityStatus: "eligible",
    eligibilityCode: "active",
    eligibilityReason: "Available for this booking.",
    ...overrides,
  };
}

describe("getCleanerSelectionMode", () => {
  it("returns team_only for deep and move in/out cleaning", () => {
    expect(getCleanerSelectionMode("deep-cleaning")).toBe("team_only");
    expect(getCleanerSelectionMode("moving-cleaning")).toBe("team_only");
  });

  it("returns cleaner_with_team_option for regular, airbnb, office, and carpet", () => {
    expect(getCleanerSelectionMode("regular-cleaning")).toBe("cleaner_with_team_option");
    expect(getCleanerSelectionMode("airbnb-cleaning")).toBe("cleaner_with_team_option");
    expect(getCleanerSelectionMode("office-cleaning")).toBe("cleaner_with_team_option");
    expect(getCleanerSelectionMode("carpet-cleaning")).toBe("cleaner_with_team_option");
  });
});

describe("filterDisplayableCleaners", () => {
  it("keeps only eligible cleaners", () => {
    const eligible = card({ cleanerId: "ok" });
    const ineligible = card({
      cleanerId: "no",
      eligibilityStatus: "ineligible",
      eligibilityCode: "schedule_conflict",
      eligibilityReason: "Booked at this time.",
    });

    expect(filterDisplayableCleaners([eligible, ineligible])).toEqual([eligible]);
  });
});

describe("getTeamOptionCopy", () => {
  it("uses team-only copy for deep and move services", () => {
    const copy = getTeamOptionCopy("team_only");
    expect(copy.title).toBe("Shalean team");
    expect(copy.description).toMatch(/Shalean team for larger or detailed jobs/);
    expect(copy.recommendedBadge).toBe(true);
  });

  it("uses prefer-a-team copy for cleaner-with-team services", () => {
    const copy = getTeamOptionCopy("cleaner_with_team_option");
    expect(copy.title).toBe("Prefer a team");
    expect(copy.description).toMatch(/suitable team/);
    expect(copy.recommendedBadge).toBe(false);
  });
});

describe("showsIndividualCleanerList", () => {
  it("is false for team_only and true for cleaner_with_team_option", () => {
    expect(showsIndividualCleanerList("team_only")).toBe(false);
    expect(showsIndividualCleanerList("cleaner_with_team_option")).toBe(true);
  });
});

describe("empty state copy", () => {
  it("explains team fallback when no individuals are available", () => {
    expect(NO_INDIVIDUAL_CLEANERS_EMPTY_STATE).toMatch(
      /No individual cleaners available/,
    );
    expect(NO_INDIVIDUAL_CLEANERS_EMPTY_STATE).toMatch(/best available team/);
  });
});
