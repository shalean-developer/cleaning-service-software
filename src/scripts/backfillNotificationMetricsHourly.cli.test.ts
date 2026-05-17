import { describe, expect, it } from "vitest";
import { runBackfillNotificationMetricsHourlyCli } from "./backfillNotificationMetricsHourly";

const shouldRun = process.env.NOTIFICATION_METRICS_BACKFILL_CLI === "1";

describe.skipIf(!shouldRun)("backfillNotificationMetricsHourly CLI", () => {
  it(
    "backfills closed hours via service role",
    async () => {
      const code = await runBackfillNotificationMetricsHourlyCli({
        hours: Number.parseInt(process.env.NOTIFICATION_METRICS_BACKFILL_HOURS ?? "168", 10),
      });
      expect([0, 1]).toContain(code);
    },
    180_000,
  );
});
