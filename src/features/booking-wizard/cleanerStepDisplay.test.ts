import { describe, expect, it } from "vitest";
import type { CleanerPublicCard } from "@/features/cleaners/server/types";
import {
  cleanerCardExperienceHint,
  cleanerCardSubtitle,
  CLEANER_LIST_INITIAL_VISIBLE,
} from "./cleanerStepDisplay";

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

describe("cleanerStepDisplay", () => {
  it("exposes initial visible count of 5", () => {
    expect(CLEANER_LIST_INITIAL_VISIBLE).toBe(5);
  });

  it("uses short subtitle for eligible cleaners", () => {
    expect(cleanerCardSubtitle(card())).toBe("Mon–Fri mornings");
  });

  it("maps ineligible codes to short reasons", () => {
    expect(
      cleanerCardSubtitle(
        card({
          eligibilityStatus: "ineligible",
          eligibilityCode: "schedule_conflict",
          eligibilityReason: "Cleaner already has a booking during this time.",
        }),
      ),
    ).toBe("Booked at this time");
  });

  it("truncates long service area hints", () => {
    const hint = cleanerCardExperienceHint(
      card({
        serviceAreasSummary: "A very long service area summary that should be truncated for display",
      }),
    );
    expect(hint).toMatch(/…$/);
  });
});
