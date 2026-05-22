import { describe, expect, it } from "vitest";
import {
  supportRequestAgeBucket,
  supportRequestSlaStatus,
  SUPPORT_SLA_TARGETS,
} from "./supportRequestSla";

describe("supportRequestSla", () => {
  const now = new Date("2026-05-22T12:00:00.000Z");

  it("detects urgent first-response breach after 1 hour", () => {
    const createdAt = new Date(now.getTime() - 65 * 60_000).toISOString();
    const sla = supportRequestSlaStatus({
      status: "open",
      requestType: "payment_help",
      createdAt,
      updatedAt: createdAt,
      acknowledgedAt: null,
      resolvedAt: null,
      scheduledStart: null,
      requestedDateTimeIso: null,
      now,
    });
    expect(sla.slaCategory).toBe("urgent");
    expect(sla.slaStatus).toBe("breached");
    expect(sla.ageBucket).toBe("1_to_8h");
  });

  it("warns standard requests before 8h breach", () => {
    const createdAt = new Date(
      now.getTime() - SUPPORT_SLA_TARGETS.standardFirstResponseMinutes * 60_000 * 0.85,
    ).toISOString();
    const sla = supportRequestSlaStatus({
      status: "open",
      requestType: "general_message",
      createdAt,
      updatedAt: createdAt,
      acknowledgedAt: null,
      resolvedAt: null,
      scheduledStart: null,
      requestedDateTimeIso: null,
      now,
    });
    expect(sla.slaCategory).toBe("standard");
    expect(sla.slaStatus).toBe("warning");
  });

  it("computes age buckets", () => {
    expect(supportRequestAgeBucket(30)).toBe("under_1h");
    expect(supportRequestAgeBucket(120)).toBe("1_to_8h");
    expect(supportRequestAgeBucket(12 * 60)).toBe("8_to_24h");
    expect(supportRequestAgeBucket(36 * 60)).toBe("24_to_48h");
    expect(supportRequestAgeBucket(72 * 60)).toBe("over_48h");
  });

  it("records time to first response when acknowledged", () => {
    const createdAt = "2026-05-22T10:00:00.000Z";
    const ackAt = "2026-05-22T10:45:00.000Z";
    const sla = supportRequestSlaStatus({
      status: "acknowledged",
      requestType: "general_message",
      createdAt,
      updatedAt: ackAt,
      acknowledgedAt: ackAt,
      resolvedAt: null,
      scheduledStart: null,
      requestedDateTimeIso: null,
      now: new Date("2026-05-22T11:00:00.000Z"),
    });
    expect(sla.timeToFirstResponseMinutes).toBe(45);
  });
});
