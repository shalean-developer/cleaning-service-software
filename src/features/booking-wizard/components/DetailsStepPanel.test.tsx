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
    officeSizeTier: null,
    officeWorkstations: null,
    cleaningIntensity: "standard" as const,
    equipmentSupply: "shalean" as const,
    requestedTeamSize: 2 as const,
    addons: [],
    carpetStainSeverity: null,
    carpetPetStains: false,
    carpetGoodDryingAirflow: false,
    specialInstructions: "",
    stepErrors: {},
    onBedroomsChange: noop,
    onBathroomsChange: noop,
    onExtraRoomsChange: noop,
    onPropertySizeSqmChange: noop,
    onOfficeSizeChange: noop,
    onOfficeWorkstationsChange: noop,
    onCleaningIntensityChange: noop,
    onEquipmentSupplyChange: noop,
    onRequestedTeamSizeChange: noop,
    onAddonsChange: noop,
    onCarpetStainSeverityChange: noop,
    onCarpetPetStainsChange: noop,
    onCarpetGoodDryingAirflowChange: noop,
    onSpecialInstructionsChange: noop,
  };

  it("renders step heading and section hierarchy without frequency", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...baseProps} />);

    expect(html).toContain("Your home &amp; options");
    expect(html).toContain("Tell us what affects time, supplies, and support.");
    expect(html).not.toContain("Visit frequency");
    expect(html).toContain("Home size");
    expect(html).toContain("Cleaning intensity");
    expect(html).toContain("Add-ons");
    expect(html).toContain("Inside cabinets");
    expect(html).not.toMatch(/<details[^>]*>[\s\S]*Add-ons/);
    expect(html).toContain("Supplies &amp; support");
    expect(html).toContain("Notes");
    expect(html.indexOf("Home size")).toBeLessThan(html.indexOf("Cleaning intensity"));
    expect(html.indexOf("Cleaning intensity")).toBeLessThan(html.indexOf("Add-ons"));
    expect(html.indexOf("Add-ons")).toBeLessThan(html.indexOf("Supplies &amp; support"));
    expect(html.indexOf("Supplies &amp; support")).toBeLessThan(html.indexOf("Notes"));
  });

  it("renders bedrooms, bathrooms, and extra rooms in one row for deep-cleaning", () => {
    const html = renderToStaticMarkup(
      <DetailsStepPanel
        {...baseProps}
        serviceSlug="deep-cleaning"
        extraRooms={2}
      />,
    );

    expect(html).toContain("md:grid-cols-3");
    expect(html).toContain("Extra rooms");
    expect(html).not.toContain("per extra room");
    expect(html.indexOf("Bedrooms")).toBeLessThan(html.indexOf("Bathrooms"));
    expect(html.indexOf("Bathrooms")).toBeLessThan(html.indexOf("Extra rooms"));
    expect(html).not.toContain("Supplies &amp; support");
  });

  it("renders bedrooms, bathrooms, and extra rooms in one row for moving-cleaning", () => {
    const html = renderToStaticMarkup(
      <DetailsStepPanel
        {...baseProps}
        serviceSlug="moving-cleaning"
        extraRooms={1}
      />,
    );

    expect(html).toContain("md:grid-cols-3");
    expect(html).toContain("Extra rooms");
    expect(html.indexOf("Bedrooms")).toBeLessThan(html.indexOf("Extra rooms"));
  });

  it("keeps two-column home size for airbnb-cleaning without extra rooms", () => {
    const html = renderToStaticMarkup(
      <DetailsStepPanel {...baseProps} serviceSlug="airbnb-cleaning" extraRooms={0} />,
    );

    expect(html).not.toContain("md:grid-cols-3");
    expect(html).not.toContain("Extra rooms");
  });

  it("does not render extra rooms for carpet-cleaning", () => {
    const html = renderToStaticMarkup(
      <DetailsStepPanel
        {...baseProps}
        serviceSlug="carpet-cleaning"
        extraRooms={3}
      />,
    );

    expect(html).not.toContain("Extra rooms");
  });

  it("renders office size cards and workstation chips without sqm input", () => {
    const html = renderToStaticMarkup(
      <DetailsStepPanel {...baseProps} serviceSlug="office-cleaning" />,
    );

    expect(html).toContain("Office size");
    expect(html).toContain("Workstations (approx.)");
    expect(html).toContain("Small office");
    expect(html).not.toContain("sqm");
    expect(html).not.toContain('type="number"');
    expect(html).toContain("Extras");
  });

  it("renders visible extra rooms, equipment, and team support hints", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...baseProps} />);

    expect(html).toContain("Shalean supplies equipment");
    expect(html).toContain("+ R 100");
    expect(html).toContain("Team support request");
    expect(html).toContain("+ R 200");
    expect(html).toContain("availability confirmed after payment");
    expect(html).not.toContain("Best for routine upkeep");
    expect(html).toContain("Heavy use");
    expect(html).toContain("+15%");
    expect(html).toContain("Post-event / extra dirty");
    expect(html).toContain("+30%");
    expect(html).toContain('role="switch"');
    expect(html).toContain("md:grid-cols-3");
    expect(html).not.toContain("sr-only");
  });
});
