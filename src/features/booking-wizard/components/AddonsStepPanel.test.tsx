import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AddonsStepPanel } from "./AddonsStepPanel";

describe("AddonsStepPanel", () => {
  it("renders compact rows with prices and toggle switches", () => {
    const html = renderToStaticMarkup(
      <AddonsStepPanel selected={["laundry"]} onChange={() => {}} />,
    );

    expect(html).toContain("rounded-xl border border-zinc-200/90");
    expect(html).toContain("Laundry");
    expect(html).toContain("Wash, dry, fold");
    expect(html).toContain("+ R 120");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("bg-zinc-900");
    expect(html).not.toContain("bg-blue-500");
    expect(html).toContain("Inside oven");
    expect(html).toContain("Racks, glass, interior degrease");
  });

  it("lists all catalog add-ons in display order", () => {
    const html = renderToStaticMarkup(
      <AddonsStepPanel selected={[]} onChange={() => {}} />,
    );

    const laundryIndex = html.indexOf("Laundry");
    const windowsIndex = html.indexOf("Interior windows");
    const fridgeIndex = html.indexOf("Inside fridge");
    const ovenIndex = html.indexOf("Inside oven");
    const balconyIndex = html.indexOf("Balcony");

    expect(laundryIndex).toBeGreaterThan(-1);
    expect(windowsIndex).toBeGreaterThan(laundryIndex);
    expect(fridgeIndex).toBeGreaterThan(windowsIndex);
    expect(ovenIndex).toBeGreaterThan(fridgeIndex);
    expect(balconyIndex).toBeGreaterThan(ovenIndex);
  });
});
