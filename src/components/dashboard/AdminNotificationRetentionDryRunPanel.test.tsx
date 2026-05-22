import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminNotificationRetentionDryRunPanel } from "./AdminNotificationRetentionDryRunPanel";
import type { NotificationRetentionDryRunReport } from "@/features/notifications/server/notificationRetentionTypes";

const sampleReport: NotificationRetentionDryRunReport = {
  dryRun: true,
  deleted: 0,
  asOf: "2026-05-17T12:00:00.000Z",
  policy: {
    outboxLiveSentDays: 90,
    outboxDryRunSentDays: 60,
    outboxFailedMaxDays: 365,
    outboxUnsupportedPendingDays: 180,
    workerRunsDays: 90,
    metricsMonths: 13,
    requeueShieldDays: 30,
  },
  eligible: {
    outbox: {
      liveSentOlderThanPolicy: 10,
      dryRunSentOlderThanPolicy: 3,
      failedOlderThanPolicy: 1,
      unsupportedPendingOlderThanPolicy: 50,
    },
    workerRuns: {
      olderThanPolicy: 100,
      eligibleWithRollupCoverage: 95,
      protectedMissingRollup: 5,
    },
    metricsHourly: { olderThanPolicy: 0 },
  },
  protected: {
    outbox: {
      pendingDeliverable: 2,
      processing: 1,
      failedWithinRetention: 4,
      requeueShieldRecent: 1,
    },
  },
  oldestEligible: {
    liveSent: "2025-01-01T00:00:00.000Z",
    dryRunSent: null,
    failedExpired: null,
    unsupportedPending: "2024-06-01T00:00:00.000Z",
    workerRuns: "2025-02-01T00:00:00.000Z",
    metricsHourly: null,
  },
};

describe("AdminNotificationRetentionDryRunPanel", () => {
  it("renders dry-run copy and counts without action buttons", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationRetentionDryRunPanel retention={sampleReport} />,
    );
    expect(html).toContain("Dry-run only. no data is deleted");
    expect(html).toContain(">10<");
    expect(html).toContain(">95<");
    expect(html).toContain("Pending deliverable");
    expect(html).not.toContain("<button");
    expect(html).not.toMatch(/@/);
    expect(html).not.toContain("recipient");
    expect(html).not.toContain("payload");
  });
});
