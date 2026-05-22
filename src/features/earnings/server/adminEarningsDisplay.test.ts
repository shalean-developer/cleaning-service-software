import { describe, expect, it } from "vitest";
import { normalizeAdminEarningsPeriod, payoutStatusLabel } from "./adminEarningsDisplay";
import { resolveAdminEarningsPeriodBounds } from "./adminEarningsPeriod";
import { mapEarningPayoutStatusToUi } from "./adminEarningsPresentation";

describe("adminEarningsDisplay", () => {
  it("defaults unknown period to week", () => {
    expect(normalizeAdminEarningsPeriod(undefined)).toBe("week");
    expect(normalizeAdminEarningsPeriod("invalid")).toBe("week");
  });

  it("labels payout statuses for display", () => {
    expect(payoutStatusLabel("held")).toBe("Held for review");
  });
});

describe("adminEarningsPeriod", () => {
  it("resolves week bounds with mix label", () => {
    const bounds = resolveAdminEarningsPeriodBounds("week", new Date("2026-05-22T10:00:00+02:00"));
    expect(bounds.periodMixLabel).toBe("This week");
    expect(bounds.revenueCardLabel).toBe("This week revenue");
    expect(bounds.endExclusiveIso > bounds.startIso).toBe(true);
  });
});

describe("adminEarningsPresentation", () => {
  it("maps earning payout statuses to UI tones", () => {
    expect(mapEarningPayoutStatusToUi("pending")).toBe("held");
    expect(mapEarningPayoutStatusToUi("payout_ready")).toBe("scheduled");
    expect(mapEarningPayoutStatusToUi("paid")).toBe("released");
  });
});
