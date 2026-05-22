import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DetailsStepPanel } from "./DetailsStepPanel";

describe("DetailsStepPanel. add-ons visibility", () => {
  const noop = () => {};

  const baseProps = {
    serviceSlug: "regular-cleaning" as const,
    bedrooms: 2,
    bathrooms: 1,
    extraRooms: 0,
    propertySizeSqm: null,
    officeSizeTier: null,
    officeWorkstations: null,
    cleaningIntensity: "standard" as const,
    equipmentSupply: "customer" as const,
    requestedTeamSize: 1 as const,
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

  it("shows add-on options immediately without a collapsible extras wrapper", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...baseProps} />);

    expect(html).toContain("Add-ons");
    expect(html).toContain("Inside cabinets");
    expect(html).not.toContain("Add extras");
    expect(html).not.toMatch(/<details[^>]*>[\s\S]*Add-ons/);
  });

  it("shows deep/move add-ons immediately for deep cleaning", () => {
    const html = renderToStaticMarkup(
      <DetailsStepPanel {...baseProps} serviceSlug="deep-cleaning" />,
    );

    expect(html).toContain("Detailed cleaning extras");
    expect(html).toContain("Balcony cleaning");
    expect(html).toContain("Couch cleaning");
    expect(html).not.toContain("Add extras");
  });
});
