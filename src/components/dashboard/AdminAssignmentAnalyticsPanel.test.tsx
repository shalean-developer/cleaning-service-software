import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminAssignmentAnalyticsPanel } from "./AdminAssignmentAnalyticsPanel";
import type { AdminAssignmentAnalyticsPage } from "@/features/assignments/server/assignmentAnalyticsReadModel";
import { buildAssignmentPathMetrics24h } from "@/features/assignments/server/assignmentAnalyticsPathDto";
import { emptyAssignmentMetricsPathCounters } from "@/features/assignments/server/assignmentAnalyticsPathMetrics";
import { buildAssignmentLatency24h } from "@/features/assignments/server/assignmentLatencyDto";

const pathTerminals = {
  selected: 12,
  best_available: 15,
  admin_manual: 4,
  unknown: 0,
};

const byPath = buildAssignmentPathMetrics24h(
  {
    ...emptyAssignmentMetricsPathCounters(),
    offers_created_selected_count: 8,
    offers_created_best_available_count: 10,
    offers_created_admin_manual_count: 3,
    offers_accepted_selected_count: 5,
    offers_accepted_best_available_count: 6,
    offers_accepted_admin_manual_count: 2,
  },
  pathTerminals,
);

const lowVolumeByPath = buildAssignmentPathMetrics24h(
  {
    ...emptyAssignmentMetricsPathCounters(),
    offers_created_selected_count: 2,
    offers_accepted_selected_count: 1,
  },
  { selected: 2, best_available: 0, admin_manual: 0, unknown: 0 },
);

const latency24h = buildAssignmentLatency24h({
  timeToFirstOfferDurations: Array.from({ length: 12 }, () => 15),
  cleanerResponseDurations: Array.from({ length: 14 }, () => 204),
  timeToAssignedDurations: Array.from({ length: 11 }, () => 306),
});

const lowSampleLatency = buildAssignmentLatency24h({
  timeToFirstOfferDurations: [5, 10],
  cleanerResponseDurations: [],
  timeToAssignedDurations: Array.from({ length: 10 }, () => 90),
});

const sample: AdminAssignmentAnalyticsPage = {
  live24h: {
    offersCreated: 10,
    offersAccepted: 6,
    offersDeclined: 2,
    offersExpired: 1,
    offersCancelled: 1,
    terminalOffers: 10,
    acceptRatePercent: 60,
    declineRatePercent: 20,
    expireRatePercent: 10,
    bookingsAssigned: 6,
    redispatchBookings: 3,
    maxAttemptsBookings: 1,
    adminInterventions: 2,
    byPath,
    latency24h,
  },
  trends7d: {
    offersCreated7d: 80,
    offersCreated7dPrior: 70,
    offersCreated7dDeltaPercent: 14.3,
    acceptRate7dPercent: 58,
    acceptRate7dPriorPercent: 55,
    acceptRate7dDeltaPoints: 3,
    bookingsAssigned7d: 45,
    redispatchBookings7d: 20,
    maxAttemptsBookings7d: 4,
    byPath7d: {
      selected: {
        offersCreated7d: 20,
        offersAccepted7d: 12,
        acceptRate7dPercent: 60,
        acceptRate7dLabel: "60%",
      },
      best_available: {
        offersCreated7d: 50,
        offersAccepted7d: 28,
        acceptRate7dPercent: 56,
        acceptRate7dLabel: "56%",
      },
      admin_manual: {
        offersCreated7d: 10,
        offersAccepted7d: 8,
        acceptRate7dPercent: 80,
        acceptRate7dLabel: "80%",
      },
      unknown: {
        offersCreated7d: 0,
        offersAccepted7d: 0,
        acceptRate7dPercent: null,
        acceptRate7dLabel: "Not enough data",
      },
    },
    rollupAsOf: "2026-05-18T11:00:00.000Z",
    coverageHours7d: 120,
    coverageComplete: true,
    partialCoverageNote: null,
  },
  latencyTrends7d: {
    timeToFirstOffer: {
      approximateMedianMinutes: 12,
      sampleCount: 55,
      status: "ok",
    },
    cleanerResponse: {
      approximateMedianMinutes: 204,
      sampleCount: 60,
      status: "ok",
    },
    timeToAssigned: {
      approximateMedianMinutes: 150,
      sampleCount: 42,
      status: "ok",
    },
    coverageHours7d: 120,
    coverageComplete: true,
    partialCoverageNote: null,
  },
};

describe("AdminAssignmentAnalyticsPanel (7B-1b-min)", () => {
  it("renders path breakdown rows for selected, best available, and admin manual", () => {
    const html = renderToStaticMarkup(<AdminAssignmentAnalyticsPanel analytics={sample} />);
    expect(html).toContain("Assignment path breakdown");
    expect(html).toContain("Selected cleaner");
    expect(html).toContain("Best available");
    expect(html).toContain("Admin manual");
    expect(html).toContain("current booking metadata");
    expect(html).toContain("By assignment path (7d)");
  });

  it("shows Not enough data for low-volume path accept rate", () => {
    const page: AdminAssignmentAnalyticsPage = {
      ...sample,
      live24h: { ...sample.live24h, byPath: lowVolumeByPath },
    };
    const html = renderToStaticMarkup(<AdminAssignmentAnalyticsPanel analytics={page} />);
    expect(html).toContain("Not enough data");
  });

  it("has no mutation controls", () => {
    const html = renderToStaticMarkup(<AdminAssignmentAnalyticsPanel analytics={sample} />);
    expect(html).not.toContain('type="submit"');
    expect(html).not.toContain("<button");
  });

  it("renders assignment latency section with medians and sample sizes", () => {
    const html = renderToStaticMarkup(<AdminAssignmentAnalyticsPanel analytics={sample} />);
    expect(html).toContain("Assignment latency");
    expect(html).toContain("Median time to first offer");
    expect(html).toContain("Median cleaner response");
    expect(html).toContain("Median time to assigned");
    expect(html).toContain("15 min");
    expect(html).toContain("3.4 h");
    expect(html).toContain("n=12");
    expect(html).toContain("rolling 24h window");
  });

  it("renders 7d approximate latency cards from rollups", () => {
    const html = renderToStaticMarkup(<AdminAssignmentAnalyticsPanel analytics={sample} />);
    expect(html).toContain("Assignment latency (7d rollup)");
    expect(html).toContain("7d median time to first offer");
    expect(html).toContain("7d median cleaner response");
    expect(html).toContain("7d median time to assigned");
    expect(html).toContain("~12 min");
    expect(html).toContain("~3.4 h");
    expect(html).toContain("~2.5 h");
    expect(html).toContain("n=55");
    expect(html).toContain("bucket midpoints");
    expect(html).not.toContain("time_to_assigned_bucket");
    expect(html).not.toContain("cleaner_response_bucket");
  });

  it("shows Insufficient data when latency sample is below threshold", () => {
    const page: AdminAssignmentAnalyticsPage = {
      ...sample,
      live24h: { ...sample.live24h, latency24h: lowSampleLatency },
    };
    const html = renderToStaticMarkup(<AdminAssignmentAnalyticsPanel analytics={page} />);
    expect(html).toContain("Insufficient data");
    expect(html).toContain("need ≥10");
  });
});
