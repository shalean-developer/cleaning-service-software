import { describe, expect, it } from "vitest";
import { getAddonStepDisplayOrder, getAddonStepLabel } from "./addonStepDisplay";
import { AIRBNB_ADDON_STEP_DISPLAY_ORDER } from "./airbnbCleaningDisplay";
import { OFFICE_ADDON_STEP_DISPLAY_ORDER } from "./officeCleaningDisplay";
import { CARPET_ADDON_STEP_DISPLAY_ORDER } from "./carpetCleaningDisplay";
import { DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER } from "./deepMovingAddonDisplay";
import { REGULAR_CLEANING_ADDON_STEP_DISPLAY_ORDER } from "./constants";

describe("serviceExtrasDisplay", () => {
  it("keeps regular cleaning extras unchanged", () => {
    expect(getAddonStepDisplayOrder("regular-cleaning")).toEqual(
      REGULAR_CLEANING_ADDON_STEP_DISPLAY_ORDER,
    );
  });

  it("keeps deep/move extras unchanged", () => {
    expect(getAddonStepDisplayOrder("deep-cleaning")).toEqual(DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER);
    expect(getAddonStepDisplayOrder("moving-cleaning")).toEqual(DEEP_MOVING_ADDON_STEP_DISPLAY_ORDER);
  });

  it("shows Airbnb turnover extras only", () => {
    expect(getAddonStepDisplayOrder("airbnb-cleaning")).toEqual(AIRBNB_ADDON_STEP_DISPLAY_ORDER);
    expect(getAddonStepLabel("laundry", "airbnb-cleaning")).toBe("Laundry & linen change");
    expect(getAddonStepLabel("same-day-urgent-turnaround", "airbnb-cleaning")).toBe(
      "Same-day urgent turnaround",
    );
    const airbnb = getAddonStepDisplayOrder("airbnb-cleaning");
    expect(airbnb).not.toContain("interior-walls");
    expect(airbnb).not.toContain("couch-cleaning");
  });

  it("shows office commercial extras only", () => {
    expect(getAddonStepDisplayOrder("office-cleaning")).toEqual(OFFICE_ADDON_STEP_DISPLAY_ORDER);
    expect(getAddonStepLabel("sanitization-treatment", "office-cleaning")).toBe(
      "Sanitization treatment",
    );
    const office = getAddonStepDisplayOrder("office-cleaning");
    expect(office).not.toContain("inside-oven");
    expect(office).not.toContain("laundry");
  });

  it("shows carpet fabric extras only", () => {
    expect(getAddonStepDisplayOrder("carpet-cleaning")).toEqual(CARPET_ADDON_STEP_DISPLAY_ORDER);
    expect(getAddonStepLabel("stain-treatment", "carpet-cleaning")).toBe("Stain treatment");
    const carpet = getAddonStepDisplayOrder("carpet-cleaning");
    expect(carpet).toContain("couch-cleaning");
    expect(carpet).toContain("fabric-protection");
    expect(carpet).not.toContain("inside-fridge");
  });
});
