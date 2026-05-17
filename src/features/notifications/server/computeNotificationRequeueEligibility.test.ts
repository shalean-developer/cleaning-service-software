import { describe, expect, it } from "vitest";
import type { NotificationOutboxRow } from "@/lib/database/types";
import { computeNotificationRequeueEligibility } from "./computeNotificationRequeueEligibility";

function row(overrides: Partial<NotificationOutboxRow> = {}): NotificationOutboxRow {
  return {
    id: "outbox-1",
    channel: "email",
    recipient: "cust-1",
    payload: { template: "payment_confirmed", bookingId: "booking-1" },
    status: "failed",
    attempts: 2,
    next_retry_at: null,
    last_error: "ERR",
    created_at: "2026-05-17T10:00:00.000Z",
    updated_at: "2026-05-17T10:01:00.000Z",
    ...overrides,
  };
}

describe("computeNotificationRequeueEligibility", () => {
  it("is false outside booking detail context", () => {
    expect(computeNotificationRequeueEligibility(row())).toEqual({
      canRequeue: false,
      requeueBlockReason: "NOT_BOOKING_DETAIL_CONTEXT",
    });
  });

  it("is true for failed deliverable row in booking detail", () => {
    expect(
      computeNotificationRequeueEligibility(row(), { bookingDetailContext: true }),
    ).toEqual({ canRequeue: true });
  });

  it("blocks sent, pending, processing", () => {
    expect(
      computeNotificationRequeueEligibility(row({ status: "sent" }), {
        bookingDetailContext: true,
      }).requeueBlockReason,
    ).toBe("LIVE_ALREADY_SENT");
    expect(
      computeNotificationRequeueEligibility(row({ status: "pending" }), {
        bookingDetailContext: true,
      }).requeueBlockReason,
    ).toBe("PENDING");
    expect(
      computeNotificationRequeueEligibility(row({ status: "processing" }), {
        bookingDetailContext: true,
      }).requeueBlockReason,
    ).toBe("PROCESSING");
  });

  it("blocks unsupported templates", () => {
    expect(
      computeNotificationRequeueEligibility(
        row({
          payload: { template: "payment_pending", bookingId: "booking-1" },
        }),
        { bookingDetailContext: true },
      ).requeueBlockReason,
    ).toBe("UNSUPPORTED_TEMPLATE");
  });
});
