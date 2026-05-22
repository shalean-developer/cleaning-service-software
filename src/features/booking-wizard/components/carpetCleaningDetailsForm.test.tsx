import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getAddonStepDisplayOrder } from "../addonStepDisplay";
import { DetailsStepPanel } from "./DetailsStepPanel";

const CARPET = "carpet-cleaning" as const;
const noop = () => {};

const carpetProps = {
  serviceSlug: CARPET,
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

const regularProps = {
  ...carpetProps,
  serviceSlug: "regular-cleaning" as const,
};

describe("DetailsStepPanel. carpet cleaning form", () => {
  it("shows carpet scope intro and carpeted rooms", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...carpetProps} />);

    expect(html).toContain("Carpet scope");
    expect(html).toContain("Standalone floor-care");
    expect(html).toContain("Carpeted rooms / zones");
    expect(html).toContain("Carpeted rooms");
    expect(html).toContain("Select 1–6");
    expect(html).not.toContain("Bedrooms");
    expect(html).not.toContain("Bathrooms");
  });

  it("renders stain severity cards", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...carpetProps} />);

    expect(html).toContain("Stain severity");
    expect(html).toContain("Light marks");
    expect(html).toContain("General refresh.");
    expect(html).toContain("Noticeable stains");
    expect(html).toContain("Extra spotting time.");
    expect(html).toContain("Heavy staining");
    expect(html).toContain("Dedicated stain work.");
  });

  it("renders pet stains and drying airflow toggles", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...carpetProps} />);

    expect(html).toContain("Pet stains?");
    expect(html).toContain("Good drying airflow?");
    expect(html).toContain('role="switch"');
  });

  it("shows carpet fabric add-ons and hides residential add-ons", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...carpetProps} />);

    expect(html).toContain("Carpet add-ons");
    expect(html).toContain("Mattress cleaning");
    expect(html).toContain("Couch cleaning");
    expect(html).toContain("Rug cleaning");
    expect(html).toContain("Stain treatment");
    expect(html).toContain("Fabric protection");
    expect(html).not.toContain("Soon");
    expect(html).not.toContain("Inside oven");
    expect(html).not.toContain("Inside fridge");
    expect(html).not.toContain("Inside cabinets");
    expect(html).not.toContain("Interior walls");
    expect(html).not.toContain("Ironing");
    expect(html).not.toContain("Interior windows");
  });

  it("uses carpet-specific notes placeholder", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...carpetProps} />);

    expect(html).toContain("Access, pets, stain areas, ventilation notes.");
  });

  it("leaves regular cleaning form unchanged", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...regularProps} />);

    expect(html).toContain("Bedrooms");
    expect(html).toContain("Bathrooms");
    expect(html).toContain("Extra rooms");
    expect(html).toContain("Supplies &amp; support");
    expect(html).toContain("Add-ons");
    expect(html).not.toContain("Carpet scope");
    expect(html).not.toContain("Stain severity");
    expect(html).not.toContain("Mattress cleaning");
  });

  it("does not show extra rooms on carpet cleaning", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...carpetProps} />);
    expect(html).not.toContain("Extra rooms");
  });
});

describe("addonStepDisplay. carpet cleaning", () => {
  it("orders all carpet fabric add-ons for catalog helpers", () => {
    expect(getAddonStepDisplayOrder(CARPET)).toEqual([
      "mattress-cleaning",
      "couch-cleaning",
      "rug-cleaning",
      "stain-treatment",
      "deodorizing-treatment",
      "fabric-protection",
      "upholstery-refresh",
    ]);
  });
});
