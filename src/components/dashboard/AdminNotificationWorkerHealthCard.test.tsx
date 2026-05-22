import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminNotificationWorkerHealthCard } from "./AdminNotificationWorkerHealthCard";
import type { AdminNotificationWorkerHealthModel } from "@/features/notifications/server/notificationWorkerRunTypes";

const neverRunHealth: AdminNotificationWorkerHealthModel = {
  hasRun: false,
  completedAt: null,
  ageMinutes: null,
  healthLevel: "unknown",
  healthMessage: "No worker runs recorded yet.",
  ok: null,
  deliveryEnabled: null,
  emailProvider: null,
  triggerSource: null,
  reclaimed: null,
  scanned: null,
  sent: null,
  skipped: null,
  failed: null,
  dryRun: null,
  errorCount: null,
};

const healthyRun: AdminNotificationWorkerHealthModel = {
  hasRun: true,
  completedAt: "2026-05-17T12:00:00.000Z",
  ageMinutes: 2,
  healthLevel: "healthy",
  healthMessage: "Last run 2m ago. cron appears healthy.",
  ok: true,
  deliveryEnabled: true,
  emailProvider: "resend",
  triggerSource: "cron",
  reclaimed: 0,
  scanned: 3,
  sent: 2,
  skipped: 0,
  dryRun: 1,
  failed: 0,
  errorCount: 0,
};

describe("AdminNotificationWorkerHealthCard", () => {
  it("shows Never run primary copy when worker has not run", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationWorkerHealthCard workerHealth={neverRunHealth} />,
    );
    expect(html).toContain("Never run");
    expect(html).toContain("Run the notification cron once to begin worker history.");
    expect(html).not.toContain("No worker runs recorded yet.");
    expect(html).toContain("Unknown");
  });

  it("shows health message when a run exists", () => {
    const html = renderToStaticMarkup(
      <AdminNotificationWorkerHealthCard workerHealth={healthyRun} />,
    );
    expect(html).toContain("Last run 2m ago. cron appears healthy.");
    expect(html).not.toContain("Never run");
    expect(html).toContain("Healthy");
  });
});
