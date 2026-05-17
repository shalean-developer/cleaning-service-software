import { describe, expect, it } from "vitest";
import {
  computeWorkerRunListStatus,
  mapNotificationWorkerRunForAdmin,
  shortWorkerRunId,
} from "./mapNotificationWorkerRunForAdmin";

const baseRow = {
  id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  completed_at: "2026-05-17T12:00:00.000Z",
  ok: true,
  delivery_enabled: true,
  email_provider: "dry_run",
  trigger_source: "cron" as const,
  reclaimed: 1,
  scanned: 4,
  sent: 2,
  skipped: 1,
  failed: 0,
  dry_run: 1,
  error_count: 0,
};

describe("mapNotificationWorkerRunForAdmin", () => {
  it("shortens id and omits errors from mapped output", () => {
    const mapped = mapNotificationWorkerRunForAdmin(
      {
        ...baseRow,
        id: "run-uuid-full-value",
      },
      new Date("2026-05-17T12:05:00.000Z"),
    );
    expect(mapped.idShort).toBe(shortWorkerRunId("run-uuid-full-value"));
    expect(JSON.stringify(mapped)).not.toContain("errors");
    expect(mapped.ageMinutes).toBe(5);
    expect(mapped.statusLabel).toBe("OK");
  });

  it("marks partial when ok with row failures", () => {
    const mapped = mapNotificationWorkerRunForAdmin({
      ...baseRow,
      failed: 2,
      error_count: 2,
    });
    expect(mapped.statusLabel).toBe("Partial");
    expect(mapped.statusTone).toBe("warning");
  });

  it("marks failed when route ok is false", () => {
    const mapped = mapNotificationWorkerRunForAdmin({ ...baseRow, ok: false });
    expect(mapped.statusLabel).toBe("Failed");
    expect(mapped.statusTone).toBe("danger");
  });
});

describe("computeWorkerRunListStatus", () => {
  it("returns OK when no failures", () => {
    expect(computeWorkerRunListStatus(true, 0, 0).label).toBe("OK");
  });
});
