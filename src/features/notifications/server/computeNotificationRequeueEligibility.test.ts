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
  it("is false when requeue actions are disabled", () => {
    expect(computeNotificationRequeueEligibility(row())).toEqual({
      canRequeue: false,
      requeueBlockReason: "REQUEUE_ACTIONS_DISABLED",
    });
  });

  it("is true for failed deliverable row when requeue actions enabled", () => {
    expect(
      computeNotificationRequeueEligibility(row(), { requeueActionsEnabled: true }),
    ).toEqual({ canRequeue: true });
  });

  it("blocks sent, pending, processing", () => {
    expect(
      computeNotificationRequeueEligibility(row({ status: "sent" }), {
        requeueActionsEnabled: true,
      }).requeueBlockReason,
    ).toBe("LIVE_ALREADY_SENT");
    expect(
      computeNotificationRequeueEligibility(row({ status: "pending" }), {
        requeueActionsEnabled: true,
      }).requeueBlockReason,
    ).toBe("PENDING");
    expect(
      computeNotificationRequeueEligibility(row({ status: "processing" }), {
        requeueActionsEnabled: true,
      }).requeueBlockReason,
    ).toBe("PROCESSING");
  });

  it("blocks dry-run sent rows (5E-1b-β deferred)", () => {
    expect(
      computeNotificationRequeueEligibility(
        row({
          status: "sent",
          last_error:
            "dry_run_sent;template=payment_confirmed;bookingId=booking-1;recipientType=customer",
        }),
        { requeueActionsEnabled: true },
      ).requeueBlockReason,
    ).toBe("LIVE_ALREADY_SENT");
  });

  it("blocks unsupported templates", () => {
    expect(
      computeNotificationRequeueEligibility(
        row({
          payload: { template: "payment_pending", bookingId: "booking-1" },
        }),
        { requeueActionsEnabled: true },
      ).requeueBlockReason,
    ).toBe("UNSUPPORTED_TEMPLATE");
  });
});
