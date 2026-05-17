import { describe, expect, it } from "vitest";
import type { NotificationOutboxRow } from "@/lib/database/types";
import {
  ADMIN_BOOKING_NOTIFICATION_LIMIT,
  deriveNotificationRecipientType,
  mapNotificationOutboxRowForAdmin,
  parseDryRunMetadataFromLastError,
  sanitizeNotificationLastError,
} from "./mapNotificationOutboxRowForAdmin";

function baseRow(
  overrides: Partial<NotificationOutboxRow> = {},
): NotificationOutboxRow {
  return {
    id: "outbox-1",
    channel: "email",
    recipient: "cust-uuid",
    payload: { template: "payment_confirmed", bookingId: "booking-1" },
    status: "sent",
    attempts: 1,
    next_retry_at: null,
    last_error: null,
    created_at: "2026-05-17T10:00:00.000Z",
    updated_at: "2026-05-17T10:01:00.000Z",
    ...overrides,
  };
}

describe("sanitizeNotificationLastError", () => {
  it("redacts email-like strings", () => {
    expect(sanitizeNotificationLastError("Failed for user@example.com")).toBe(
      "Failed for [redacted]",
    );
  });

  it("returns null for empty input", () => {
    expect(sanitizeNotificationLastError(null)).toBeNull();
    expect(sanitizeNotificationLastError("   ")).toBeNull();
  });
});

describe("parseDryRunMetadataFromLastError", () => {
  it("parses dry_run_sent metadata", () => {
    const meta = parseDryRunMetadataFromLastError(
      "dry_run_sent;template=payment_confirmed;bookingId=booking-1;recipientType=customer",
    );
    expect(meta).toEqual({
      template: "payment_confirmed",
      bookingId: "booking-1",
      offerId: null,
      recipientType: "customer",
    });
  });

  it("returns null for non-dry-run errors", () => {
    expect(parseDryRunMetadataFromLastError("SEND_FAILED")).toBeNull();
  });
});

describe("mapNotificationOutboxRowForAdmin", () => {
  it("maps safe fields from a valid row", () => {
    const mapped = mapNotificationOutboxRowForAdmin(baseRow());
    expect(mapped).toMatchObject({
      id: "outbox-1",
      template: "payment_confirmed",
      status: "sent",
      channel: "email",
      recipientType: "customer",
      bookingId: "booking-1",
      offerId: null,
      attemptCount: 1,
    });
    expect(mapped).not.toHaveProperty("payload");
    expect(mapped).not.toHaveProperty("recipient");
    expect(mapped.isDeliverable).toBe(true);
    expect(mapped.canRequeue).toBe(false);
  });

  it("sets canRequeue for failed deliverable in booking detail context", () => {
    const mapped = mapNotificationOutboxRowForAdmin(
      baseRow({ status: "failed" }),
      { bookingDetailContext: true },
    );
    expect(mapped.canRequeue).toBe(true);
  });

  it("does not set canRequeue for live sent in booking detail", () => {
    const mapped = mapNotificationOutboxRowForAdmin(
      baseRow({ status: "sent" }),
      { bookingDetailContext: true },
    );
    expect(mapped.canRequeue).toBe(false);
    expect(mapped.requeueBlockReason).toBe("LIVE_ALREADY_SENT");
  });

  it("marks unsupported templates as not deliverable", () => {
    const mapped = mapNotificationOutboxRowForAdmin(
      baseRow({
        payload: { template: "payment_pending", bookingId: "booking-1" },
        status: "pending",
      }),
    );
    expect(mapped.isDeliverable).toBe(false);
  });

  it("handles malformed payload", () => {
    const mapped = mapNotificationOutboxRowForAdmin(
      baseRow({ payload: null, channel: "email" }),
    );
    expect(mapped.template).toBe("unknown");
    expect(mapped.bookingId).toBeNull();
    expect(mapped.offerId).toBeNull();
    expect(mapped.recipientType).toBe("unknown");
  });

  it("never exposes raw payload or recipient email in serialized output", () => {
    const mapped = mapNotificationOutboxRowForAdmin(
      baseRow({
        recipient: "cust-uuid",
        payload: {
          template: "payment_failed",
          bookingId: "booking-1",
          secret: "should-not-appear",
          email: "leak@example.com",
        },
        last_error: "Provider rejected leak@example.com",
      }),
    );
    const json = JSON.stringify(mapped);
    expect(json).not.toContain("should-not-appear");
    expect(json).not.toContain("leak@example.com");
    expect(json).not.toContain("cust-uuid");
    expect(mapped.lastError).toBe("Provider rejected [redacted]");
  });

  it("surfaces dry-run note when metadata present", () => {
    const mapped = mapNotificationOutboxRowForAdmin(
      baseRow({
        status: "sent",
        last_error:
          "dry_run_sent;template=assignment_offer;bookingId=booking-1;offerId=offer-1;recipientType=cleaner",
        payload: { template: "assignment_offer", bookingId: "booking-1", offerId: "offer-1" },
        channel: "push",
      }),
    );
    expect(mapped.isDryRun).toBe(true);
    expect(mapped.statusNote).toContain("Dry run");
    expect(mapped.offerId).toBe("offer-1");
    expect(deriveNotificationRecipientType("assignment_offer")).toBe("cleaner");
  });
});

describe("ADMIN_BOOKING_NOTIFICATION_LIMIT", () => {
  it("caps booking history at 25 rows", () => {
    expect(ADMIN_BOOKING_NOTIFICATION_LIMIT).toBe(25);
  });
});
