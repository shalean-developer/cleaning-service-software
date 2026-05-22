import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AddonsStepPanel } from "./AddonsStepPanel";

describe("AddonsStepPanel", () => {
  it("renders compact rows with visible descriptions, prices, and toggle switches", () => {
    const html = renderToStaticMarkup(
      <AddonsStepPanel
        serviceSlug="deep-cleaning"
        selected={["couch-cleaning"]}
        onChange={() => {}}
      />,
    );

    expect(html).toContain("rounded-xl border border-slate-200/90");
    expect(html).toContain("sm:grid-cols-2");
    expect(html).toContain("Couch cleaning");
    expect(html).toContain("fabric-safe");
    expect(html).toContain("+ R 150");
    expect(html).toContain('role="switch"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("bg-shalean-primary");
    expect(html).not.toContain("bg-blue-500");
    expect(html).toContain("Balcony cleaning");
    expect(html).toContain("Detailed cleaning extras");
  });

  it("lists deep-cleaning add-ons in service display order", () => {
    const html = renderToStaticMarkup(
      <AddonsStepPanel serviceSlug="deep-cleaning" selected={[]} onChange={() => {}} />,
    );

    const balconyIndex = html.indexOf("Balcony cleaning");
    const carpetIndex = html.indexOf("Carpet cleaning");
    const ceilingIndex = html.indexOf("Ceiling cleaning");
    const garageIndex = html.indexOf("Garage cleaning");
    const mattressIndex = html.indexOf("Mattress cleaning");
    const outsideIndex = html.indexOf("Outside windows");
    const couchIndex = html.indexOf("Couch cleaning");

    expect(balconyIndex).toBeGreaterThan(-1);
    expect(carpetIndex).toBeGreaterThan(balconyIndex);
    expect(ceilingIndex).toBeGreaterThan(carpetIndex);
    expect(garageIndex).toBeGreaterThan(ceilingIndex);
    expect(mattressIndex).toBeGreaterThan(garageIndex);
    expect(outsideIndex).toBeGreaterThan(mattressIndex);
    expect(couchIndex).toBeGreaterThan(outsideIndex);
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

  it("renders office cleaning with grouped compact extras panel", () => {
    const html = renderToStaticMarkup(
      <AddonsStepPanel serviceSlug="office-cleaning" selected={[]} onChange={() => {}} />,
    );

    expect(html).toContain("Extras");
    expect(html).toContain("Workspace care");
    expect(html).toContain("Kitchen &amp; hygiene");
    expect(html).not.toContain("Commercial cleaning extras");
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
