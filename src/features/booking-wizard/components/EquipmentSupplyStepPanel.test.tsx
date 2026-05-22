import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EquipmentSupplyStepPanel } from "./EquipmentSupplyStepPanel";

describe("EquipmentSupplyStepPanel", () => {
  it("renders label, visible hint, info control, and a switch", () => {
    const html = renderToStaticMarkup(
      <EquipmentSupplyStepPanel value="customer" onChange={() => {}} />,
    );

    expect(html).toContain("Cleaning equipment");
    expect(html).not.toContain("You provide supplies");
    expect(html).toContain("More information");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain("I have cleaning supplies");
  });

  it("checks switch when shalean equipment is selected", () => {
    const html = renderToStaticMarkup(
      <EquipmentSupplyStepPanel value="shalean" onChange={() => {}} />,
    );

    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("bg-shalean-primary");
    expect(html).toContain("Shalean supplies equipment");
    expect(html).toContain("+ R 100");
  });
});
