import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { CronJobHealthSnapshot } from "@/features/operations/server/cronHealthTypes";
import {
  AdminCronHealthCriticalBanner,
  AdminCronHealthPanel,
} from "./AdminCronHealthPanel";

const criticalJob: CronJobHealthSnapshot = {
  id: "dispatch",
  name: "Dispatch deferred",
  routePath: "/api/cron/dispatch-deferred-assignments",
  scheduleSource: "ops_configured",
  scheduleHint: "Hourly",
  expectedFrequencyMinutes: 60,
  docPath: "docs/cron.md",
  launchRequired: true,
  enabled: true,
  status: "critical",
  statusMessage: "No successful run in 24h",
  lastSuccessfulRunAt: null,
  lastFailureRunAt: "2026-01-01T00:00:00Z",
  recentFailureCount24h: 3,
  backlogCount: 5,
  backlogLabel: "Candidates",
  hasRunTelemetry: true,
};

describe("AdminCronHealthPanel", () => {
  it("renders critical banner for critical jobs", () => {
    const html = renderToStaticMarkup(
      <AdminCronHealthCriticalBanner jobs={[criticalJob]} />,
    );
    expect(html).toContain("Critical cron jobs need attention");
    expect(html).toContain("Dispatch deferred");
    expect(html).toContain("No successful run in 24h");
  });

  it("renders full panel content when embedded", () => {
    const html = renderToStaticMarkup(
      <AdminCronHealthPanel
        generatedAt="2026-01-01T00:00:00Z"
        cronSecretConfigured
        jobs={[criticalJob]}
        embedded
      />,
    );
    expect(html).toContain("Launch-critical cron visibility");
    expect(html).toContain("Critical");
    expect(html).not.toContain("<h2");
  });
});
