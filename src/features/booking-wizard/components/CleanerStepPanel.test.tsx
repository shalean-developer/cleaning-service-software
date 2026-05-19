import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CleanerStepPanel } from "./CleanerStepPanel";

const sampleCleaner = {
  cleanerId: "c1",
  displayName: "Sam N.",
  rating: 4.8,
  eligibilityStatus: "eligible" as const,
  eligibilityCode: "active" as const,
  eligibilityReason: "Available for this booking.",
  serviceAreasSummary: "Northern suburbs",
  availabilitySummary: "Mon–Fri mornings",
};

describe("CleanerStepPanel", () => {
  it("uses zinc selected styling instead of inverted dark cards", () => {
    const html = renderToStaticMarkup(
      <CleanerStepPanel
        cleanerPreferenceMode="selected"
        selectedCleanerId="c1"
        availableCleaners={[sampleCleaner]}
        loading={false}
        onSelectBestAvailable={() => {}}
        onSelectCleaner={() => {}}
      />,
    );

    expect(html).toContain("border-zinc-900");
    expect(html).toContain("bg-zinc-50");
    expect(html).not.toContain("bg-zinc-900 text-white");
  });

  it("renders recommended best available and selection guide", () => {
    const html = renderToStaticMarkup(
      <CleanerStepPanel
        cleanerPreferenceMode="best_available"
        selectedCleanerId={null}
        availableCleaners={[sampleCleaner]}
        loading={false}
        onSelectBestAvailable={() => {}}
        onSelectCleaner={() => {}}
      />,
    );

    expect(html).toContain("Choose your cleaner");
    expect(html).toContain("Recommended");
    expect(html).toContain("Best available cleaner");
    expect(html).toContain("Fastest assignment");
    expect(html).toContain("How cleaner selection works");
    expect(html).not.toContain("max-h-64");
    expect(html).not.toContain("overflow-y-auto");
  });

  it("shows selected-cleaner fallback copy and hides long eligibility on card face", () => {
    const html = renderToStaticMarkup(
      <CleanerStepPanel
        cleanerPreferenceMode="selected"
        selectedCleanerId="c1"
        availableCleaners={[sampleCleaner]}
        loading={false}
        onSelectBestAvailable={() => {}}
        onSelectCleaner={() => {}}
      />,
    );

    expect(html).toContain("try your selected cleaner first");
    expect(html).toContain("Mon–Fri mornings");
    expect(html).toContain('aria-label="Sam N., rating 4.8. Available for this booking."');
  });

  it("lists view-all control when more than five cleaners", () => {
    const cleaners = Array.from({ length: 6 }, (_, i) => ({
      ...sampleCleaner,
      cleanerId: `c${i}`,
      displayName: `Cleaner ${i}`,
    }));

    const html = renderToStaticMarkup(
      <CleanerStepPanel
        cleanerPreferenceMode="best_available"
        selectedCleanerId={null}
        availableCleaners={cleaners}
        loading={false}
        onSelectBestAvailable={() => {}}
        onSelectCleaner={() => {}}
      />,
    );

    expect(html).toContain("View all cleaners (6)");
    expect(html).not.toContain("Cleaner 5");
  });
});
