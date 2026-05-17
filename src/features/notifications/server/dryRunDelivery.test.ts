import { describe, expect, it } from "vitest";
import {
  buildDryRunDeliveryPreview,
  formatDryRunSentMetadata,
} from "./dryRunDelivery";
import type { Json, NotificationOutboxRow } from "@/lib/database/types";

function row(payload: Json): NotificationOutboxRow {
  const ts = "2026-05-17T10:00:00.000Z";
  return {
    id: "outbox-1",
    channel: "email",
    recipient: "recipient-1",
    payload,
    status: "pending",
    attempts: 0,
    next_retry_at: null,
    last_error: null,
    created_at: ts,
    updated_at: ts,
  };
}

describe("dryRunDelivery", () => {
  it("builds safe preview without email addresses", () => {
    const preview = buildDryRunDeliveryPreview(
      row({ template: "payment_confirmed", bookingId: "booking-1" }),
    );
    expect(preview).toEqual({
      outboxId: "outbox-1",
      template: "payment_confirmed",
      bookingId: "booking-1",
      offerId: null,
      recipientType: "customer",
    });
    expect(JSON.stringify(preview)).not.toContain("@");
  });

  it("uses cleaner recipient type for assignment_offer", () => {
    const preview = buildDryRunDeliveryPreview(
      row({
        template: "assignment_offer",
        bookingId: "booking-1",
        offerId: "offer-1",
      }),
    );
    expect(preview.recipientType).toBe("cleaner");
    expect(preview.offerId).toBe("offer-1");
  });

  it("formats dry_run_sent metadata", () => {
    const meta = formatDryRunSentMetadata({
      outboxId: "outbox-1",
      template: "payment_failed",
      bookingId: "booking-2",
      offerId: null,
      recipientType: "customer",
    });
    expect(meta).toBe(
      "dry_run_sent;template=payment_failed;bookingId=booking-2;recipientType=customer",
    );
    expect(meta).not.toContain("@");
  });
});
