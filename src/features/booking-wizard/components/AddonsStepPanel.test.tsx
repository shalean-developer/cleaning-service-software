import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AddonsStepPanel } from "./AddonsStepPanel";

describe("AddonsStepPanel", () => {
  it("renders compact rows with visible descriptions, prices, and toggle switches", () => {
    const html = renderToStaticMarkup(
      <AddonsStepPanel
        serviceSlug="deep-cleaning"
        selected={["laundry"]}
        onChange={() => {}}
      />,
    );

    expect(html).toContain("rounded-xl border border-zinc-200/90");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("Laundry");
    expect(html).toContain("Wash, dry, fold");
    expect(html).toContain("+ R 120");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("bg-zinc-900");
    expect(html).not.toContain("bg-blue-500");
    expect(html).toContain("Inside oven");
    expect(html).toContain("Oven interior degreased");
    expect(html).toContain("Detailed cleaning extras");
  });

  it("lists all catalog add-ons in display order for non-regular services", () => {
    const html = renderToStaticMarkup(
      <AddonsStepPanel serviceSlug="deep-cleaning" selected={[]} onChange={() => {}} />,
    );

    const cabinetsIndex = html.indexOf("Inside cabinets");
    const ovenIndex = html.indexOf("Inside oven");
    const fridgeIndex = html.indexOf("Inside fridge");
    const wallsIndex = html.indexOf("Interior walls");
    const windowsIndex = html.indexOf("Interior windows");
    const balconyIndex = html.indexOf("Balcony");
    const laundryIndex = html.indexOf("Laundry");

    expect(cabinetsIndex).toBeGreaterThan(-1);
    expect(ovenIndex).toBeGreaterThan(cabinetsIndex);
    expect(fridgeIndex).toBeGreaterThan(ovenIndex);
    expect(wallsIndex).toBeGreaterThan(fridgeIndex);
    expect(windowsIndex).toBeGreaterThan(wallsIndex);
    expect(balconyIndex).toBeGreaterThan(windowsIndex);
    expect(laundryIndex).toBeGreaterThan(balconyIndex);
  });

  it("shows only regular-cleaning add-ons and hides balcony", () => {
    const html = renderToStaticMarkup(
      <AddonsStepPanel
        serviceSlug="regular-cleaning"
        selected={["laundry"]}
        onChange={() => {}}
      />,
    );

    expect(html).toContain("Inside cabinets");
    expect(html).toContain("+ R 120");
    expect(html).toContain("Interior walls");
    expect(html).toContain("+ R 100");
    expect(html).toContain("Ironing &amp; Laundry");
    expect(html).toContain("Inside oven");
    expect(html).toContain("Inside fridge");
    expect(html).toContain("Interior windows");
    expect(html).not.toContain("Balcony");
    expect(html).not.toContain(">Laundry<");
  });

  it("lists regular-cleaning add-ons in product order", () => {
    const html = renderToStaticMarkup(
      <AddonsStepPanel serviceSlug="regular-cleaning" selected={[]} onChange={() => {}} />,
    );

    const cabinetsIndex = html.indexOf("Inside cabinets");
    const ovenIndex = html.indexOf("Inside oven");
    const fridgeIndex = html.indexOf("Inside fridge");
    const wallsIndex = html.indexOf("Interior walls");
    const laundryIndex = html.indexOf("Ironing &amp; Laundry");
    const windowsIndex = html.indexOf("Interior windows");

    expect(cabinetsIndex).toBeGreaterThan(-1);
    expect(ovenIndex).toBeGreaterThan(cabinetsIndex);
    expect(fridgeIndex).toBeGreaterThan(ovenIndex);
    expect(wallsIndex).toBeGreaterThan(fridgeIndex);
    expect(laundryIndex).toBeGreaterThan(wallsIndex);
    expect(windowsIndex).toBeGreaterThan(laundryIndex);
  });
});
