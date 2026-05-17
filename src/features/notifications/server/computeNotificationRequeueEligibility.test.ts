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

const dryRunSentError =
  "dry_run_sent;template=payment_confirmed;bookingId=booking-1;recipientType=customer";

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

  it("blocks pending and processing", () => {
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

  it("blocks live sent rows", () => {
    expect(
      computeNotificationRequeueEligibility(row({ status: "sent", last_error: null }), {
        requeueActionsEnabled: true,
      }).requeueBlockReason,
    ).toBe("LIVE_ALREADY_SENT");
    expect(
      computeNotificationRequeueEligibility(
        row({ status: "sent", last_error: "Delivered via Resend" }),
        { requeueActionsEnabled: true },
      ).requeueBlockReason,
    ).toBe("LIVE_ALREADY_SENT");
  });

  it.each([
    ["payment_confirmed", { template: "payment_confirmed", bookingId: "booking-1" }, "email"],
    ["payment_failed", { template: "payment_failed", bookingId: "booking-1" }, "email"],
    [
      "assignment_offer",
      { template: "assignment_offer", bookingId: "booking-1", offerId: "offer-1" },
      "push",
    ],
  ])(
    "allows dry-run sent %s when deliverable",
    (template, payload, channel) => {
      expect(
        computeNotificationRequeueEligibility(
          row({
            status: "sent",
            channel,
            payload,
            last_error: `dry_run_sent;template=${template};bookingId=booking-1;recipientType=customer`,
          }),
          { requeueActionsEnabled: true },
        ),
      ).toEqual({ canRequeue: true });
    },
  );

  it("blocks unsupported dry-run sent templates", () => {
    expect(
      computeNotificationRequeueEligibility(
        row({
          status: "sent",
          payload: { template: "payment_pending", bookingId: "booking-1" },
          last_error: "dry_run_sent;template=payment_pending;bookingId=booking-1",
        }),
        { requeueActionsEnabled: true },
      ).requeueBlockReason,
    ).toBe("UNSUPPORTED_TEMPLATE");
  });

  it("blocks unsupported templates on failed rows", () => {
    expect(
      computeNotificationRequeueEligibility(
        row({
          payload: { template: "payment_pending", bookingId: "booking-1" },
        }),
        { requeueActionsEnabled: true },
      ).requeueBlockReason,
    ).toBe("UNSUPPORTED_TEMPLATE");
  });

  it("blocks dry-run sent with missing bookingId", () => {
    expect(
      computeNotificationRequeueEligibility(
        row({
          status: "sent",
          payload: { template: "payment_confirmed" },
          last_error: dryRunSentError,
        }),
        { requeueActionsEnabled: true },
      ).requeueBlockReason,
    ).toBe("MISSING_BOOKING_ID");
  });
});
