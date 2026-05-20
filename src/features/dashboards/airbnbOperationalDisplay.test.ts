import { describe, expect, it } from "vitest";
import {
  adminAirbnbBookingListNextAction,
  cleanerAirbnbJobStatusLabel,
  getAirbnbAdminBookingDetailCopy,
  getAirbnbAdminBookingListCopy,
  getAirbnbAdminListBadges,
  getAirbnbCleanerJobCopy,
  getAirbnbCleanerJobGuidanceSteps,
  getAirbnbCleanerOfferCopy,
  getAirbnbOperationsQueueCopy,
  isAirbnbOperationalBooking,
} from "./airbnbOperationalDisplay";

describe("airbnbOperationalDisplay", () => {
  it("identifies Airbnb from slug or catalog label", () => {
    expect(isAirbnbOperationalBooking({ serviceSlug: "airbnb-cleaning" })).toBe(true);
    expect(isAirbnbOperationalBooking({ serviceLabel: "Airbnb Cleaning" })).toBe(true);
    expect(isAirbnbOperationalBooking({ serviceSlug: "regular-cleaning" })).toBe(false);
  });

  it("returns cleaner offer turnover copy", () => {
    const copy = getAirbnbCleanerOfferCopy();
    expect(copy.serviceEyebrow).toContain("Turnover");
    expect(copy.offerSubtitle).toContain("guest arrival");
    expect(copy.accessHint).toContain("Host instructions");
  });

  it("returns cleaner job detail labels", () => {
    const copy = getAirbnbCleanerJobCopy();
    expect(copy.detailsSectionTitle).toBe("Turnover details");
    expect(copy.notesSectionTitle).toBe("Host instructions");
    expect(copy.heroSubtitle).toBe("Guest-ready turnover");
  });

  it("returns turnover guidance steps without enforcement fields", () => {
    const steps = getAirbnbCleanerJobGuidanceSteps("assigned");
    expect(steps?.length).toBeGreaterThan(0);
    expect(steps?.some((s) => s.title.includes("host"))).toBe(true);
  });

  it("uses turnover completed label for terminal cleaner statuses", () => {
    expect(cleanerAirbnbJobStatusLabel("completed")).toBe("Turnover completed");
    expect(cleanerAirbnbJobStatusLabel("assigned")).toBeNull();
  });

  it("adds admin turnover badges including same-day when scheduled today", () => {
    const today = new Date();
    const scheduledStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      14,
      0,
      0,
    ).toISOString();
    const badges = getAirbnbAdminListBadges({
      serviceLabel: "Airbnb Cleaning",
      scheduledStart,
    });
    expect(badges.map((b) => b.label)).toContain("Turnover");
    expect(badges.map((b) => b.label)).toContain("Same-day turnover");
  });

  it("returns admin list copy and reframes next action for turnovers", () => {
    expect(getAirbnbAdminBookingListCopy().listCtaLabel).toBe("Open turnover");
    const reframed = adminAirbnbBookingListNextAction(
      "Send offer or assign cleaner on booking detail when manual dispatch is eligible.",
      { serviceLabel: "Airbnb Cleaning", status: "pending_assignment" },
    );
    expect(reframed).toContain("turnover cleaner");
  });

  it("leaves non-Airbnb next action unchanged", () => {
    const action = "Send offer or assign cleaner on booking detail.";
    expect(
      adminAirbnbBookingListNextAction(action, {
        serviceLabel: "Regular Cleaning",
        status: "pending_assignment",
      }),
    ).toBe(action);
  });

  it("returns admin detail and operations queue copy", () => {
    expect(getAirbnbAdminBookingDetailCopy().heroHeadline).toBe("Airbnb turnover");
    const queue = getAirbnbOperationsQueueCopy({
      serviceLabel: "Airbnb Cleaning",
      scheduleLabel: "Mon 9 Jun",
    });
    expect(queue?.cardSubtitle).toContain("Guest-ready");
    expect(queue?.openBookingCta).toContain("turnover");
  });
});
