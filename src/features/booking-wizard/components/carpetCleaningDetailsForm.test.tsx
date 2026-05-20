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
  cleaningIntensity: "standard" as const,
  equipmentSupply: "customer" as const,
  requestedTeamSize: 1 as const,
  frequency: "once" as const,
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
  onCleaningIntensityChange: noop,
  onEquipmentSupplyChange: noop,
  onRequestedTeamSizeChange: noop,
  onFrequencyChange: noop,
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

describe("DetailsStepPanel — carpet cleaning form", () => {
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

  it("shows carpet-only add-ons and hides residential add-ons", () => {
    const html = renderToStaticMarkup(<DetailsStepPanel {...carpetProps} />);

    expect(html).toContain("Carpet add-ons");
    expect(html).toContain("Mattress cleaning");
    expect(html).toContain("Sofa cleaning");
    expect(html).toContain("Odor treatment");
    expect(html).toContain("Soon");
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
    expect(html).toContain("Add-ons");
    expect(html).not.toContain("Carpet scope");
    expect(html).not.toContain("Stain severity");
    expect(html).not.toContain("Mattress cleaning");
  });
});

describe("addonStepDisplay — carpet cleaning", () => {
  it("orders only carpet-priced add-ons for catalog helpers", () => {
    expect(getAddonStepDisplayOrder(CARPET)).toEqual(["mattress-cleaning"]);
  });
});
