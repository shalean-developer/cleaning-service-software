import { describe, expect, it } from "vitest";
import {
  adminMovingBookingListNextAction,
  getMovingAdminListBadges,
  getMovingCleanerJobGuidanceSteps,
  isMovingOperationalBooking,
} from "./movingOperationalDisplay";

describe("movingOperationalDisplay", () => {
  it("detects moving from slug or label", () => {
    expect(isMovingOperationalBooking({ serviceSlug: "moving-cleaning" })).toBe(true);
    expect(isMovingOperationalBooking({ serviceLabel: "Moving Cleaning" })).toBe(true);
    expect(isMovingOperationalBooking({ serviceSlug: "airbnb-cleaning" })).toBe(false);
  });

  it("adds move clean admin badge", () => {
    const badges = getMovingAdminListBadges({ serviceLabel: "Moving Cleaning" });
    expect(badges.some((b) => b.label === "Move clean")).toBe(true);
    expect(badges.some((b) => b.label === "Turnover")).toBe(false);
  });

  it("rewrites assignment next action for moving", () => {
    const action = adminMovingBookingListNextAction("Send offer or assign cleaner on booking detail.", {
      serviceLabel: "Moving Cleaning",
      status: "pending_assignment",
    });
    expect(action).toMatch(/move preparation/i);
  });

  it("returns move preparation guidance steps", () => {
    const steps = getMovingCleanerJobGuidanceSteps("assigned");
    expect(steps?.length).toBeGreaterThan(0);
    expect(steps?.[0]?.title).toMatch(/access/i);
    expect(JSON.stringify(steps)).not.toMatch(/guest-ready|turnover/i);
  });
});
