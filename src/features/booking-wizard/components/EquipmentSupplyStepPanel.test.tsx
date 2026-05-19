import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EquipmentSupplyStepPanel } from "./EquipmentSupplyStepPanel";

describe("EquipmentSupplyStepPanel", () => {
  it("renders label, Yes/No state, and a switch", () => {
    const html = renderToStaticMarkup(
      <EquipmentSupplyStepPanel value="customer" onChange={() => {}} />,
    );

    expect(html).toContain("Cleaning equipment");
    expect(html).toContain(">No<");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="false"');
    expect(html).not.toContain('role="radio"');
    expect(html).not.toContain("I have cleaning supplies");
  });

  it("shows Yes when shalean equipment is selected", () => {
    const html = renderToStaticMarkup(
      <EquipmentSupplyStepPanel value="shalean" onChange={() => {}} />,
    );

    expect(html).toContain(">Yes<");
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("bg-zinc-900");
  });
});
