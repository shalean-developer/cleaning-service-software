import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminNotificationAnalyticsPanel } from "./AdminNotificationAnalyticsPanel";
import type { AdminNotificationAnalytics } from "@/features/notifications/server/notificationAdminTypes";
import { computeTrends7dFromHourlyBuckets } from "@/features/notifications/server/notificationTrends7d";

const baseAnalytics: AdminNotificationAnalytics = {
  worker24h: {
    windowHours: 24,
    runCount: 5,
    runsOkPercent: 80,
    sentTotal: 10,
    failedTotal: 1,
    dryRunTotal: 2,
    scannedTotal: 12,
    skippedTotal: 0,
    reclaimedTotal: 0,
    avgSentPerRun: 2,
    avgScannedPerRun: 2.4,
    liveSuccessRatePercent: 90,
    dryRunRatioPercent: 15.4,
  },
  trends7d: computeTrends7dFromHourlyBuckets(
    [
      {
        bucket_start: "2026-05-16T10:00:00.000Z",
        run_count: 2,
        sent_count: 20,
        failed_count: 2,
        dry_run_count: 1,
        live_sent_count: 18,
        live_failed_count: 2,
      },
    ],
    new Date("2026-05-17T12:00:00.000Z"),
  ),
  queuePressure: { score: 0, level: "normal", label: "Normal queue pressure" },
  deliverableTemplates: [],
  unsupportedTemplates: [],
  dryRunModeActive: false,
};

describe("AdminNotificationAnalyticsPanel", () => {
  it("renders 24h analytics and 7-day text trends without sensitive fields", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationAnalyticsPanel analytics={baseAnalytics} />,
    );
    expect(html).toContain("Delivery analytics (24h)");
    expect(html).toContain("7-day trends");
    expect(html).toContain("Sent (7d):");
    expect(html).toContain("Live success rate (7d):");
    expect(html).not.toMatch(/@/);
    expect(html).not.toContain("errors");
    expect(html).not.toContain("payload");
    expect(html).not.toContain("<button");
  });

  it("shows partial coverage note when rollups are incomplete", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationAnalyticsPanel
        analytics={{
          ...baseAnalytics,
          trends7d: {
            ...baseAnalytics.trends7d,
            partialCoverageNote: "Trends based on 12 of 168 hourly buckets",
            coverageComplete: false,
          },
        }}
      />,
    );
    expect(html).toContain("Trends based on 12 of 168 hourly buckets");
  });
});
