import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminNotificationRecentWorkerRunsTable } from "./AdminNotificationRecentWorkerRunsTable";
import type { AdminNotificationWorkerRunListItem } from "@/features/notifications/server/notificationWorkerRunTypes";

const sampleRun: AdminNotificationWorkerRunListItem = {
  idShort: "run-abc1",
  completedAt: "2026-05-17T12:00:00.000Z",
  ageMinutes: 3,
  ok: true,
  statusLabel: "OK",
  statusTone: "success",
  triggerSource: "cron",
  emailProvider: "resend",
  deliveryEnabled: true,
  reclaimed: 0,
  scanned: 5,
  sent: 4,
  skipped: 0,
  failed: 1,
  dryRun: 0,
  errorCount: 1,
};

describe("AdminNotificationRecentWorkerRunsTable", () => {
  it("renders empty state when no runs", () => {
    const html = renderToStaticMarkup(<AdminNotificationRecentWorkerRunsTable runs={[]} />);
    expect(html).toContain("No worker runs recorded yet.");
    expect(html).not.toContain("<button");
  });

  it("renders recent runs without mutation actions or raw errors", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationRecentWorkerRunsTable runs={[sampleRun]} />,
    );
    expect(html).toContain("Recent worker runs");
    expect(html).toContain("run-abc1");
    expect(html).toContain("scanned 5");
    expect(html).toContain("resend");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Requeue");
    expect(html).not.toContain("errors");
    expect(html).not.toMatch(/@/);
  });
});
