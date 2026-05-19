import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DetailsStepPanel } from "./DetailsStepPanel";

describe("DetailsStepPanel — regular cleaning hints", () => {
  const noop = () => {};

  const baseProps = {
    serviceSlug: "regular-cleaning" as const,
    bedrooms: 2,
    bathrooms: 1,
    extraRooms: 1,
    propertySizeSqm: null,
    cleaningIntensity: "standard" as const,
    equipmentSupply: "shalean" as const,
    requestedTeamSize: 2 as const,
    frequency: "weekly" as const,
    addons: [],
    specialInstructions: "",
    stepErrors: {},
    onBedroomsChange: noop,
    onBathroomsChange: noop,
    onExtraRoomsChange: noop,
    onPropertySizeSqmChange: noop,
    onCleaningIntensityChange: noop,
    onEquipmentSupplyChange: noop,
    onRequestedTeamSizeChange: noop,
    onFrequencyChange: noop,
    onAddonsChange: noop,
    onSpecialInstructionsChange: noop,
  };

  it("renders step heading and section hierarchy", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...baseProps} />);

    expect(html).toContain("Your home &amp; options");
    expect(html).toContain("Tell us what affects time, supplies, and support.");
    expect(html).toContain("Visit frequency");
    expect(html).toContain("Home size");
    expect(html).toContain("Cleaning intensity");
    expect(html).toContain("Add-ons");
    expect(html).toContain("Supplies &amp; support");
    expect(html).toContain("Notes");
    expect(html.indexOf("Visit frequency")).toBeLessThan(html.indexOf("Home size"));
    expect(html.indexOf("Home size")).toBeLessThan(html.indexOf("Cleaning intensity"));
    expect(html.indexOf("Cleaning intensity")).toBeLessThan(html.indexOf("Add-ons"));
    expect(html.indexOf("Add-ons")).toBeLessThan(html.indexOf("Supplies &amp; support"));
    expect(html.indexOf("Supplies &amp; support")).toBeLessThan(html.indexOf("Notes"));
  });

  it("renders visible extra rooms, equipment, and team support hints", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...baseProps} />);

    expect(html).toContain("+ R 70");
    expect(html).toContain("per extra room");
    expect(html).toContain("Shalean supplies equipment");
    expect(html).toContain("+ R 100");
    expect(html).toContain("Team support request");
    expect(html).toContain("+ R 200");
    expect(html).toContain("availability confirmed after payment");
    expect(html).toContain("Best for routine upkeep");
    expect(html).toContain("Heavy use");
    expect(html).toContain("+15%");
    expect(html).toContain("Post-event / extra dirty");
    expect(html).toContain("+30%");
    expect(html).toContain('role="switch"');
    expect(html).toContain("md:grid-cols-3");
    expect(html).not.toContain("sr-only");
  });
});
