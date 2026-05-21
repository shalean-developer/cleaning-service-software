import { describe, expect, it } from "vitest";
import { filledState } from "./testFixtures";
import {
  buildWizardBookingSummarySnapshot,
  getWizardEstimatedTotalCents,
} from "./wizardBookingSummaryDisplay";
import { WIZARD_SERVICE_OPTIONS } from "./constants";

describe("wizardBookingSummaryDisplay", () => {
  const state = filledState({ frequency: "weekly", addons: ["laundry"] });
  const serviceLabel =
    WIZARD_SERVICE_OPTIONS.find((s) => s.slug === state.serviceSlug)?.label ?? "Regular cleaning";

  const baseInput = {
    serviceLabel,
    serviceSlug: state.serviceSlug,
    date: state.date,
    time: state.time,
    suburb: state.suburb,
    city: state.city,
    bedrooms: state.bedrooms,
    bathrooms: state.bathrooms,
    extraRooms: state.extraRooms,
    propertySizeSqm: state.propertySizeSqm,
    cleaningIntensity: state.cleaningIntensity,
    equipmentSupply: state.equipmentSupply,
    requestedTeamSize: state.requestedTeamSize,
    frequency: state.frequency,
    addons: state.addons,
  };

  it("builds primary recap and a positive estimated total for a filled regular booking", () => {
    const snapshot = buildWizardBookingSummarySnapshot(baseInput);

    expect(snapshot.service).toBe(serviceLabel);
    expect(snapshot.when).toBeTruthy();
    expect(snapshot.home).toMatch(/bed/);
    expect(snapshot.secondaryRows.some((r) => r.label === "Where")).toBe(false);
    expect(snapshot.secondaryRows.some((r) => r.label === "Supplies")).toBe(false);
    expect(
      snapshot.secondaryRows.some((r) => r.label === "Frequency" && r.value.includes("Weekly")),
    ).toBe(true);
    expect(snapshot.estimatedTotalCents).toBeGreaterThan(0);
    expect(getWizardEstimatedTotalCents(baseInput)).toBe(snapshot.estimatedTotalCents);
  });

  it("omits standard intensity and empty extra rooms from secondary rows", () => {
    const snapshot = buildWizardBookingSummarySnapshot({
      ...baseInput,
      cleaningIntensity: "standard",
      extraRooms: 0,
      addons: [],
    });

    expect(snapshot.secondaryRows.some((r) => r.label === "Intensity")).toBe(false);
    expect(snapshot.secondaryRows.some((r) => r.label === "Extra rooms")).toBe(false);
    expect(snapshot.secondaryRows.some((r) => r.label === "Add-ons")).toBe(false);
  });

  it("includes frequency and add-ons for airbnb-cleaning in secondary rows", () => {
    const snapshot = buildWizardBookingSummarySnapshot({
      ...baseInput,
      serviceLabel: "Airbnb Cleaning",
      serviceSlug: "airbnb-cleaning",
      frequency: "weekly",
      addons: ["balcony"],
    });

    expect(
      snapshot.secondaryRows.some(
        (r) => r.label === "Preferred turnover schedule" && r.value.includes("Weekly"),
      ),
    ).toBe(true);
    expect(snapshot.secondaryRows.some((r) => r.label === "Turnover extras")).toBe(true);
    expect(snapshot.secondaryRows.some((r) => r.label === "Property")).toBe(true);
    expect(snapshot.secondaryRows.some((r) => r.label === "Intensity")).toBe(false);
  });

  it("includes property and inspection extras for moving-cleaning", () => {
    const snapshot = buildWizardBookingSummarySnapshot({
      ...baseInput,
      serviceLabel: "Move In/Out Cleaning",
      serviceSlug: "moving-cleaning",
      frequency: "once",
      addons: ["inside-cabinets"],
      suburb: "Claremont",
      city: "Cape Town",
    });

    expect(snapshot.secondaryRows.some((r) => r.label === "Property")).toBe(true);
    expect(snapshot.secondaryRows.some((r) => r.label === "Visit timing")).toBe(false);
    expect(snapshot.secondaryRows.some((r) => r.label === "Inspection extras")).toBe(true);
    expect(snapshot.secondaryRows.some((r) => r.label === "Preferred turnover schedule")).toBe(
      false,
    );
  });

  it("includes home location, extra rooms, and detailed extras for deep-cleaning", () => {
    const snapshot = buildWizardBookingSummarySnapshot({
      ...baseInput,
      serviceLabel: "Deep Cleaning",
      serviceSlug: "deep-cleaning",
      frequency: "once",
      extraRooms: 2,
      addons: ["inside-oven"],
      suburb: "Sea Point",
      city: "Cape Town",
    });

    expect(snapshot.secondaryRows.some((r) => r.label === "Home")).toBe(true);
    expect(snapshot.secondaryRows.some((r) => r.label === "Visit timing")).toBe(false);
    expect(
      snapshot.secondaryRows.some(
        (r) => r.label === "Extra rooms" && r.value.includes("2 extra"),
      ),
    ).toBe(true);
    expect(snapshot.secondaryRows.some((r) => r.label === "Detailed cleaning extras")).toBe(true);
    expect(snapshot.secondaryRows.some((r) => r.label === "Turnover extras")).toBe(false);
    expect(snapshot.secondaryRows.some((r) => r.label === "Inspection extras")).toBe(false);
  });

  it("includes cleaner preference in secondary rows on cleaner step input", () => {
    const snapshot = buildWizardBookingSummarySnapshot({
      ...baseInput,
      cleanerPreferenceMode: "selected",
      selectedCleanerDisplayName: "Jane D.",
    });

    expect(
      snapshot.secondaryRows.some((r) => r.label === "Cleaner" && r.value.includes("Jane")),
    ).toBe(true);
  });
});
