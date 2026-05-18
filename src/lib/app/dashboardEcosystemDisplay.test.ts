import { describe, expect, it } from "vitest";
import {
  dashboardFetchErrorTitle,
  DASHBOARD_LOADING_SR_LABEL,
  LIFECYCLE_GUIDANCE_PANEL_TITLE,
  PAYMENT_VERIFY_STATUS_MESSAGE,
  WIZARD_NAV_LOADING_LABEL,
} from "./dashboardEcosystemDisplay";

describe("dashboardEcosystemDisplay", () => {
  it("uses calm loading labels", () => {
    expect(DASHBOARD_LOADING_SR_LABEL).toBe("Loading…");
    expect(WIZARD_NAV_LOADING_LABEL).toBe("One moment…");
    expect(PAYMENT_VERIFY_STATUS_MESSAGE).toContain("Confirming");
  });

  it("uses conversational fetch-error titles", () => {
    expect(dashboardFetchErrorTitle("bookings", "customer")).toBe(
      "Couldn't load your bookings",
    );
    expect(dashboardFetchErrorTitle("jobs", "cleaner")).toBe("Couldn't load jobs");
    expect(dashboardFetchErrorTitle("payouts", "admin")).toBe("Couldn't load payouts");
  });

  it("aligns lifecycle guidance panel title", () => {
    expect(LIFECYCLE_GUIDANCE_PANEL_TITLE).toBe("What happens next");
  });
});
