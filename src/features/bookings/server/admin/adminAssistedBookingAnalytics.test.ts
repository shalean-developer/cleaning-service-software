import { describe, expect, it } from "vitest";
import { computeAdminAssistedBookingAnalytics } from "./adminAssistedBookingAnalytics";

describe("computeAdminAssistedBookingAnalytics", () => {
  it("aggregates link, notification, and conversion metrics", () => {
    const now = new Date("2026-05-23T14:00:00.000Z");
    const paidBookingIds = new Set(["b-paid"]);

    const analytics = computeAdminAssistedBookingAnalytics(
      [
        {
          bookingId: "b1",
          action: "admin_booking_payment_link_generated",
          createdAt: "2026-05-23T08:00:00.000Z",
          payload: {},
        },
        {
          bookingId: "b1",
          action: "admin_booking_payment_link_regenerated",
          createdAt: "2026-05-23T09:00:00.000Z",
          payload: {},
        },
        {
          bookingId: "b1",
          action: "admin_booking_payment_request_sent",
          createdAt: "2026-05-23T10:00:00.000Z",
          payload: { deliveryChannel: "email", notificationStatus: "queued" },
        },
        {
          bookingId: "b2",
          action: "admin_booking_payment_request_sent",
          createdAt: "2026-05-23T11:00:00.000Z",
          payload: { deliveryChannel: "whatsapp_copy", notificationStatus: "copied" },
        },
        {
          bookingId: "b-paid",
          action: "admin_booking_payment_link_generated",
          createdAt: "2026-05-22T08:00:00.000Z",
          payload: {},
        },
        {
          bookingId: "b-paid",
          action: "admin_booking_draft_created",
          createdAt: "2026-05-22T06:00:00.000Z",
          payload: {},
        },
        {
          bookingId: "b-paid",
          action: "admin_booking_pending_payment_created",
          createdAt: "2026-05-22T07:00:00.000Z",
          payload: {},
        },
        {
          bookingId: "b-paid",
          action: "admin_booking_offline_payment_recorded",
          createdAt: "2026-05-22T12:00:00.000Z",
          payload: {},
        },
        {
          bookingId: "b1",
          action: "admin_booking_payment_link_expired",
          createdAt: "2026-05-23T12:00:00.000Z",
          payload: {},
        },
      ],
      paidBookingIds,
      now,
    );

    expect(analytics.linksGenerated).toBe(2);
    expect(analytics.linksRegenerated).toBe(1);
    expect(analytics.emailsSent).toBe(1);
    expect(analytics.whatsappCopied).toBe(1);
    expect(analytics.expiredLinks).toBe(1);
    expect(analytics.paymentRequestsSentToday).toBe(2);
    expect(analytics.conversionRateGeneratedToPaid).toBe(0.5);
    expect(analytics.averageDraftToPaidHours).toBe(6);
    expect(analytics.averagePendingToConfirmedHours).toBe(5);
  });
});
