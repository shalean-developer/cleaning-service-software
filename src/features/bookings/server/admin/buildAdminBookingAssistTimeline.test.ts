import { describe, expect, it } from "vitest";
import { buildAdminBookingAssistTimeline } from "./buildAdminBookingAssistTimeline";
import type { AdminBookingAssistAuditRow } from "./loadAdminBookingAssistAudits";

describe("buildAdminBookingAssistTimeline", () => {
  it("maps assist audit rows to timeline entries", () => {
    const audits: AdminBookingAssistAuditRow[] = [
      {
        id: "a1",
        adminProfileId: "admin-1",
        customerId: "cust-1",
        bookingId: "book-1",
        action: "admin_booking_draft_created",
        idempotencyKey: "k1",
        payload: {},
        createdAt: "2026-01-01T10:00:00.000Z",
      },
      {
        id: "a2",
        adminProfileId: "admin-1",
        customerId: "cust-1",
        bookingId: "book-1",
        action: "admin_booking_payment_link_regenerated",
        idempotencyKey: "k2",
        payload: {
          reference: "bk_new",
          previousReference: "bk_old",
          deliveryChannel: "copy_only",
        },
        createdAt: "2026-01-01T11:00:00.000Z",
      },
    ];

    const entries = buildAdminBookingAssistTimeline({
      audits,
      bookingStatus: "pending_payment",
      paymentLink: null,
      paymentConfirmedAt: null,
    });

    expect(entries.map((e) => e.kind)).toEqual([
      "draft_created",
      "payment_link_regenerated",
    ]);
    expect(entries[1]?.previousReference).toBe("bk_old");
  });

  it("adds derived payment confirmed entry", () => {
    const entries = buildAdminBookingAssistTimeline({
      audits: [],
      bookingStatus: "confirmed",
      paymentLink: null,
      paymentConfirmedAt: "2026-01-02T09:00:00.000Z",
    });

    expect(entries.some((e) => e.kind === "payment_confirmed")).toBe(true);
  });

  it("maps payment request sent audit to timeline", () => {
    const audits: AdminBookingAssistAuditRow[] = [
      {
        id: "a3",
        adminProfileId: "admin-1",
        customerId: "cust-1",
        bookingId: "book-1",
        action: "admin_booking_payment_request_sent",
        idempotencyKey: "k3",
        payload: {
          deliveryChannel: "email",
          notificationStatus: "queued",
          reference: "bk_ref",
        },
        createdAt: "2026-01-01T12:00:00.000Z",
      },
      {
        id: "a4",
        adminProfileId: "admin-1",
        customerId: "cust-1",
        bookingId: "book-1",
        action: "admin_booking_payment_request_sent",
        idempotencyKey: "k4",
        payload: {
          deliveryChannel: "whatsapp_copy",
          notificationStatus: "copied",
          reference: "bk_ref",
        },
        createdAt: "2026-01-01T12:30:00.000Z",
      },
    ];

    const entries = buildAdminBookingAssistTimeline({
      audits,
      bookingStatus: "pending_payment",
      paymentLink: null,
      paymentConfirmedAt: null,
    });

    expect(entries.filter((e) => e.kind === "payment_request_sent")).toHaveLength(2);
    expect(entries.find((e) => e.deliveryChannel === "whatsapp_copy")?.title).toContain(
      "WhatsApp",
    );
  });

  it("maps offline payment recorded audit", () => {
    const entries = buildAdminBookingAssistTimeline({
      audits: [
        {
          id: "a5",
          adminProfileId: "admin-1",
          customerId: "cust-1",
          bookingId: "book-1",
          action: "admin_booking_offline_payment_recorded",
          idempotencyKey: "k5",
          payload: { rail: "eft", reference: "admin:offline:eft:key" },
          createdAt: "2026-01-01T13:00:00.000Z",
        },
      ],
      bookingStatus: "confirmed",
      paymentLink: null,
      paymentConfirmedAt: "2026-01-01T13:05:00.000Z",
    });

    expect(entries.some((e) => e.kind === "offline_payment_recorded")).toBe(true);
    const confirmed = entries.find((e) => e.kind === "payment_confirmed");
    expect(confirmed?.description).toContain("Offline payment finalized");
  });

  it("adds assignment started after payment on pending_assignment", () => {
    const entries = buildAdminBookingAssistTimeline({
      audits: [],
      bookingStatus: "pending_assignment",
      paymentLink: null,
      paymentConfirmedAt: "2026-01-02T09:00:00.000Z",
      paymentProvider: "paystack",
    });

    expect(entries.some((e) => e.kind === "assignment_started")).toBe(true);
  });
});
