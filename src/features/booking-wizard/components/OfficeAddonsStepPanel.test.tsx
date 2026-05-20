import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { OfficeAddonsStepPanel } from "./OfficeAddonsStepPanel";

describe("OfficeAddonsStepPanel", () => {
  it("renders grouped compact extras with operational copy", () => {
    const html = renderToStaticMarkup(
      <OfficeAddonsStepPanel selected={["boardroom-detailing"]} onChange={() => {}} />,
    );

    expect(html).toContain("Extras");
    expect(html).toContain("Workspace care");
    expect(html).toContain("Kitchen &amp; hygiene");
    expect(html).toContain("Scheduling");
    expect(html).toContain("Boardroom detailing");
    expect(html).toContain("Conference room surfaces and presentation areas.");
    expect(html).toContain("Sanitization treatment");
    expect(html).toContain("Disinfection for shared-touch office surfaces.");
    expect(html).toContain("After-hours cleaning");
    expect(html).toContain("Cleaning scheduled outside office operating hours.");
    expect(html).toContain('role="switch"');
    expect(html).toContain("rounded-lg border");
    expect(html).not.toContain("Detailed cleaning extras");
  });

  it("orders workspace care before kitchen and scheduling groups", () => {
    const html = renderToStaticMarkup(
      <OfficeAddonsStepPanel selected={[]} onChange={() => {}} />,
    );

    const workspaceIndex = html.indexOf("Workspace care");
    const kitchenIndex = html.indexOf("Kitchen &amp; hygiene");
    const schedulingIndex = html.indexOf("Scheduling");
    const boardroomIndex = html.indexOf("Boardroom detailing");
    const kitchenetteIndex = html.indexOf("Kitchenette cleaning");
    const afterHoursIndex = html.indexOf("After-hours cleaning");

    expect(workspaceIndex).toBeGreaterThan(-1);
    expect(kitchenIndex).toBeGreaterThan(workspaceIndex);
    expect(schedulingIndex).toBeGreaterThan(kitchenIndex);
    expect(boardroomIndex).toBeGreaterThan(workspaceIndex);
    expect(kitchenetteIndex).toBeGreaterThan(boardroomIndex);
    expect(afterHoursIndex).toBeGreaterThan(kitchenetteIndex);
  });
});
