import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CleanerStepPanel } from "./CleanerStepPanel";

const eligibleCleaner = {
  cleanerId: "c1",
  displayName: "Sam N.",
  rating: 4.8,
  eligibilityStatus: "eligible" as const,
  eligibilityCode: "active" as const,
  eligibilityReason: "Available for this booking.",
  serviceAreasSummary: "Northern suburbs",
  availabilitySummary: "Mon–Fri mornings",
};

const ineligibleCleaner = {
  ...eligibleCleaner,
  cleanerId: "c2",
  displayName: "Alex P.",
  eligibilityStatus: "ineligible" as const,
  eligibilityCode: "schedule_conflict" as const,
  eligibilityReason: "Cleaner already has a booking during this time.",
};

const baseProps = {
  cleanerPreferenceMode: "best_available" as const,
  selectedCleanerId: null,
  loading: false,
  onSelectBestAvailable: () => {},
  onSelectCleaner: () => {},
};

describe("CleanerStepPanel", () => {
  it("uses zinc selected styling instead of inverted dark cards", () => {
    const html = renderToStaticMarkup(
      <CleanerStepPanel
        {...baseProps}
        serviceSlug="regular-cleaning"
        cleanerPreferenceMode="selected"
        selectedCleanerId="c1"
        availableCleaners={[eligibleCleaner]}
      />,
    );

    expect(html).toContain("border-zinc-900");
    expect(html).toContain("bg-zinc-50");
    expect(html).not.toContain("bg-zinc-900 text-white");
  });

  it("shows only Shalean team for deep cleaning", () => {
    const html = renderToStaticMarkup(
      <CleanerStepPanel
        {...baseProps}
        serviceSlug="deep-cleaning"
        availableCleaners={[eligibleCleaner, ineligibleCleaner]}
      />,
    );

    expect(html).toContain("Shalean team");
    expect(html).toMatch(/handled by a Shalean team/);
    expect(html).not.toContain("Sam N.");
    expect(html).not.toContain("Alex P.");
    expect(html).not.toContain("Unavailable");
    expect(html).not.toContain("Or choose a cleaner");
    expect(html).not.toContain("Best available cleaner");
  });

  it("shows only Shalean team for move in/out cleaning", () => {
    const html = renderToStaticMarkup(
      <CleanerStepPanel
        {...baseProps}
        serviceSlug="moving-cleaning"
        availableCleaners={[eligibleCleaner]}
      />,
    );

    expect(html).toContain("Shalean team");
    expect(html).not.toContain("Sam N.");
    expect(html).not.toContain("Choose a cleaner");
  });

  it("shows available cleaners and prefer-a-team for regular cleaning", () => {
    const html = renderToStaticMarkup(
      <CleanerStepPanel
        {...baseProps}
        serviceSlug="regular-cleaning"
        availableCleaners={[eligibleCleaner, ineligibleCleaner]}
      />,
    );

    expect(html).toContain("Sam N.");
    expect(html).not.toContain("Alex P.");
    expect(html).not.toContain("Unavailable");
    expect(html).toContain("Prefer a team");
    expect(html).toMatch(/suitable team/);
    expect(html).not.toContain("Best available cleaner");
  });

  it("shows available cleaners and prefer-a-team for airbnb, office, and carpet", () => {
    for (const serviceSlug of [
      "airbnb-cleaning",
      "office-cleaning",
      "carpet-cleaning",
    ] as const) {
      const html = renderToStaticMarkup(
        <CleanerStepPanel
          {...baseProps}
          serviceSlug={serviceSlug}
          availableCleaners={[eligibleCleaner]}
        />,
      );

      expect(html).toContain("Sam N.");
      expect(html).toContain("Prefer a team");
      expect(html).not.toContain("Shalean team");
    }
  });

  it("shows empty state when no individual cleaners are available", () => {
    const html = renderToStaticMarkup(
      <CleanerStepPanel
        {...baseProps}
        serviceSlug="regular-cleaning"
        availableCleaners={[ineligibleCleaner]}
      />,
    );

    expect(html).toContain("No individual cleaners available for this slot");
    expect(html).not.toContain("Alex P.");
    expect(html).toContain("Prefer a team");
  });

  it("allows continue path with team selected on team-only services", () => {
    const html = renderToStaticMarkup(
      <CleanerStepPanel
        {...baseProps}
        serviceSlug="deep-cleaning"
        cleanerPreferenceMode="best_available"
        availableCleaners={[]}
      />,
    );

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("Shalean team");
  });

  it("lists view-all control when more than five eligible cleaners", () => {
    const cleaners = Array.from({ length: 6 }, (_, i) => ({
      ...eligibleCleaner,
      cleanerId: `c${i}`,
      displayName: `Cleaner ${i}`,
    }));

    const html = renderToStaticMarkup(
      <CleanerStepPanel
        {...baseProps}
        serviceSlug="regular-cleaning"
        availableCleaners={cleaners}
      />,
    );

    expect(html).toContain("View all cleaners (6)");
    expect(html).not.toContain("Cleaner 5");
  });

  it("renders selection guide for regular cleaning", () => {
    const html = renderToStaticMarkup(
      <CleanerStepPanel
        {...baseProps}
        serviceSlug="regular-cleaning"
        cleanerPreferenceMode="selected"
        selectedCleanerId="c1"
        availableCleaners={[eligibleCleaner]}
      />,
    );

    expect(html).toContain("Choose your cleaner");
    expect(html).toContain("try your selected cleaner first");
    expect(html).toContain("How cleaner selection works");
    expect(html).not.toContain("max-h-64");
    expect(html).not.toContain("overflow-y-auto");
  });
});
