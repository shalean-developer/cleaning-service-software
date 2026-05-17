import { describe, expect, it } from "vitest";
import type { NotificationOutboxRow } from "@/lib/database/types";
import {
  computeNotificationHealthSummaryFromRows,
  findOldestActionablePendingAgeMs,
} from "./notificationAdminAggregates";

function row(overrides: Partial<NotificationOutboxRow>): NotificationOutboxRow {
  return {
    id: "id",
    channel: "email",
    recipient: "cust-1",
    payload: { template: "payment_confirmed", bookingId: "b-1" },
    status: "pending",
    attempts: 0,
    next_retry_at: null,
    last_error: null,
    created_at: "2026-05-17T08:00:00.000Z",
    updated_at: "2026-05-17T08:00:00.000Z",
    ...overrides,
  };
}

describe("computeNotificationHealthSummaryFromRows", () => {
  const now = new Date("2026-05-17T12:00:00.000Z");

  it("counts unsupported pending separately from deliverable failures", () => {
    const summary = computeNotificationHealthSummaryFromRows(
      [
        row({
          payload: { template: "booking_draft_created", bookingId: "b-1" },
          status: "pending",
        }),
        row({
          payload: { template: "payment_failed", bookingId: "b-2" },
          status: "failed",
        }),
      ],
      { now, staleMinutes: 15 },
    );
    expect(summary.unsupportedPending).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.actionablePending).toBe(0);
  });

  it("counts stale processing for deliverable rows", () => {
    const summary = computeNotificationHealthSummaryFromRows(
      [
        row({
          status: "processing",
          updated_at: "2026-05-17T08:00:00.000Z",
        }),
      ],
      { now, staleMinutes: 15 },
    );
    expect(summary.processing).toBe(1);
    expect(summary.staleProcessing).toBe(1);
  });

  it("counts dry-run metadata on deliverable rows", () => {
    const summary = computeNotificationHealthSummaryFromRows(
      [
        row({
          status: "sent",
          last_error: "dry_run_sent;template=payment_confirmed;bookingId=b-1;recipientType=customer",
        }),
      ],
      { now, staleMinutes: 15 },
    );
    expect(summary.dryRun).toBe(1);
    expect(summary.sent).toBe(1);
  });

  it("splits actionable pending vs scheduled retry", () => {
    const summary = computeNotificationHealthSummaryFromRows(
      [
        row({ next_retry_at: null }),
        row({ next_retry_at: "2026-05-17T14:00:00.000Z" }),
      ],
      { now, staleMinutes: 15 },
    );
    expect(summary.actionablePending).toBe(1);
    expect(summary.scheduledRetry).toBe(1);
  });
});

describe("findOldestActionablePendingAgeMs", () => {
  it("returns age for oldest deliverable actionable pending row", () => {
    const now = new Date("2026-05-17T12:00:00.000Z");
    const age = findOldestActionablePendingAgeMs(
      [
        row({ created_at: "2026-05-17T10:00:00.000Z" }),
        row({ created_at: "2026-05-17T11:00:00.000Z" }),
      ],
      now,
    );
    expect(age).toBe(2 * 60 * 60 * 1000);
  });
});
