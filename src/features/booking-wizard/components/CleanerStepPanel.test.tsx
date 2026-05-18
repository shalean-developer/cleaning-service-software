import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CleanerStepPanel } from "./CleanerStepPanel";

describe("CleanerStepPanel", () => {
  it("uses zinc selected styling instead of inverted dark cards", () => {
    const html = renderToStaticMarkup(
      <CleanerStepPanel
        cleanerPreferenceMode="selected"
        selectedCleanerId="c1"
        availableCleaners={[
          {
            cleanerId: "c1",
            displayName: "Sam N.",
            rating: 4.8,
            eligibilityStatus: "eligible",
            eligibilityReason: "Available",
            serviceAreasSummary: "",
            availabilitySummary: "",
          },
        ]}
        loading={false}
        onSelectBestAvailable={() => {}}
        onSelectCleaner={() => {}}
      />,
    );

    expect(html).toContain("border-zinc-900");
    expect(html).toContain("bg-zinc-50");
    expect(html).not.toContain("bg-zinc-900 text-white");
  });
});
