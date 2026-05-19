import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EquipmentSupplyStepPanel } from "./EquipmentSupplyStepPanel";

describe("EquipmentSupplyStepPanel", () => {
  it("renders a compact toggle row with pricing detail in the info tooltip", () => {
    const html = renderToStaticMarkup(
      <EquipmentSupplyStepPanel value="customer" onChange={() => {}} />,
    );

    expect(html).toContain("Bring equipment");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain("Adds R100");
    expect(html).not.toContain("No extra charge");
    expect(html).not.toContain("Cleaning equipment");
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain("I have cleaning supplies");
  });

  it("shows the toggle on when shalean equipment is selected", () => {
    const html = renderToStaticMarkup(
      <EquipmentSupplyStepPanel value="shalean" onChange={() => {}} />,
    );

    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("bg-zinc-900");
  });
});
