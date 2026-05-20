import { describe, expect, it } from "vitest";
import {
  getDeepAdminBookingDetailCopy,
  getDeepAdminListBadges,
  getDeepCleanerJobGuidanceSteps,
  getDeepCleanerOfferCopy,
  getDeepOperationsQueueCopy,
  isDeepOperationalBooking,
} from "./deepOperationalDisplay";

const FORBIDDEN_LEAKAGE = /turnover|guest-ready|handover|move preparation/i;

describe("deepOperationalDisplay", () => {
  it("identifies Deep Cleaning from slug or catalog label", () => {
    expect(isDeepOperationalBooking({ serviceSlug: "deep-cleaning" })).toBe(true);
    expect(isDeepOperationalBooking({ serviceLabel: "Deep Cleaning" })).toBe(true);
    expect(isDeepOperationalBooking({ serviceSlug: "airbnb-cleaning" })).toBe(false);
    expect(isDeepOperationalBooking({ serviceSlug: "moving-cleaning" })).toBe(false);
  });

  it("returns cleaner offer copy without turnover language", () => {
    const offer = getDeepCleanerOfferCopy();
    expect(offer.serviceEyebrow).toMatch(/Deep cleaning/i);
    expect(offer.offerSubtitle).toMatch(/restoration|detailed/i);
    expect(JSON.stringify(offer)).not.toMatch(FORBIDDEN_LEAKAGE);
  });

  it("returns buildup-focused guidance for assigned jobs", () => {
    const steps = getDeepCleanerJobGuidanceSteps("assigned");
    expect(steps?.length).toBeGreaterThan(0);
    expect(steps?.[0]?.title).toMatch(/attention areas/i);
    expect(JSON.stringify(steps)).toMatch(/buildup|extras|restore/i);
    expect(JSON.stringify(steps)).not.toMatch(FORBIDDEN_LEAKAGE);
  });

  it("returns admin list badges for deep cleans", () => {
    const badges = getDeepAdminListBadges({ serviceLabel: "Deep Cleaning" });
    expect(badges.some((b) => b.label === "Deep clean")).toBe(true);
  });

  it("returns admin detail and operations queue copy", () => {
    expect(getDeepAdminBookingDetailCopy().heroHeadline).toBe("Detailed restoration");
    const queue = getDeepOperationsQueueCopy({
      serviceLabel: "Deep Cleaning",
      scheduleLabel: "Mon 9 Jun",
    });
    expect(queue?.cardSubtitle).toContain("restoration");
    expect(queue?.openBookingCta).toContain("deep clean");
    expect(JSON.stringify(queue)).not.toMatch(FORBIDDEN_LEAKAGE);
  });
});
