import { describe, expect, it } from "vitest";
import { buildSupportAnalyticsSnapshot } from "./supportAnalytics";

describe("supportAnalytics", () => {
  it("aggregates payment help and cancellation rates", () => {
    const snapshot = buildSupportAnalyticsSnapshot([
      {
        source: "booking_support",
        requestType: "payment_help",
        status: "open",
        suburb: "Sea Point",
        createdAt: "2026-05-20T10:00:00.000Z",
        resolvedAt: null,
        timeToResolutionMinutes: null,
      },
      {
        source: "booking_support",
        requestType: "cancel",
        status: "resolved",
        suburb: "Sea Point",
        createdAt: "2026-05-19T10:00:00.000Z",
        resolvedAt: "2026-05-20T12:00:00.000Z",
        timeToResolutionMinutes: 1560,
      },
      {
        source: "recurring_support",
        requestType: "pause",
        status: "open",
        suburb: null,
        createdAt: "2026-05-21T10:00:00.000Z",
        resolvedAt: null,
        timeToResolutionMinutes: null,
      },
    ]);

    expect(snapshot.paymentHelpCount).toBe(1);
    expect(snapshot.cancellationRequestCount).toBe(1);
    expect(snapshot.recurringVolume).toBe(1);
    expect(snapshot.topSuburbs[0]?.suburb).toBe("Sea Point");
    expect(snapshot.avgResolutionMinutesByType.cancel).toBe(1560);
  });
});
