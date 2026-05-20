import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OfficeSizingStepPanel } from "./OfficeSizingStepPanel";

describe("OfficeSizingStepPanel", () => {
  it("renders office size cards and workstation chips without sqm input", () => {
    const html = renderToStaticMarkup(
      <OfficeSizingStepPanel
        officeSizeTier="medium"
        officeWorkstations="15"
        onOfficeSizeChange={() => {}}
        onOfficeWorkstationsChange={() => {}}
      />,
    );

    expect(html).toContain("Office size");
    expect(html).toContain("We price workspaces differently from bedrooms.");
    expect(html).toContain("Small office");
    expect(html).toContain("Studio / compact suite.");
    expect(html).toContain("Medium office");
    expect(html).toContain("Large office");
    expect(html).toContain("Workstations (approx.)");
    expect(html).toContain("Desks or seats we should plan around.");
    expect(html).toContain('aria-checked="true"');
    expect(html).not.toContain("sqm");
    expect(html).not.toContain('type="number"');
  });
});
