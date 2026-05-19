import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { filledState } from "../testFixtures";
import { buildWizardBookingSummarySnapshot } from "../wizardBookingSummaryDisplay";
import { WIZARD_SERVICE_OPTIONS } from "../constants";
import {
  WizardBookingSummaryMobileCard,
  WizardBookingSummarySidebar,
} from "./WizardBookingSummarySidebar";

describe("WizardBookingSummarySidebar", () => {
  const state = filledState();
  const serviceLabel =
    WIZARD_SERVICE_OPTIONS.find((s) => s.slug === state.serviceSlug)?.label ?? "Service";
  const snapshot = buildWizardBookingSummarySnapshot({
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
  });

  it("renders desktop sticky aside hidden on small screens", () => {
    const html = renderToStaticMarkup(<WizardBookingSummarySidebar snapshot={snapshot} />);
    expect(html).toContain('aria-label="Booking summary"');
    expect(html).toContain("hidden");
    expect(html).toContain("md:block");
    expect(html).toContain("Estimated total");
    expect(html).toContain(serviceLabel);
    expect(html).toContain("More details");
  });

  it("renders mobile inline card hidden on md+", () => {
    const html = renderToStaticMarkup(<WizardBookingSummaryMobileCard snapshot={snapshot} />);
    expect(html).toContain("md:hidden");
    expect(html).toContain("Estimated total");
  });
});
