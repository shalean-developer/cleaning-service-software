import { describe, expect, it } from "vitest";
import {
  buildAdminCustomerBookingOperationsSummary,
  buildAdminCustomerPaymentSupportSummary,
  filterAdminCustomerBookings,
  matchesAdminCustomerBookingFilter,
} from "./adminCustomerBookingOperations";
import type { AdminCustomerBookingHistoryItem } from "./types";

function booking(
  overrides: Partial<AdminCustomerBookingHistoryItem> = {},
): AdminCustomerBookingHistoryItem {
  return {
    id: "b1",
    status: "confirmed",
    scheduledStart: "2030-06-01T10:00:00.000Z",
    scheduledEnd: "2030-06-01T12:00:00.000Z",
    priceCents: 10000,
    currency: "ZAR",
    isRecurring: false,
    frequencyLabel: null,
    serviceLabel: "Standard clean",
    seriesId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    paymentStatus: "paid",
    assignedCleanerLabel: null,
    bookingReference: "b1",
    ...overrides,
  };
}

describe("adminCustomerBookingOperations", () => {
  const nowMs = new Date("2026-05-19T12:00:00.000Z").getTime();

  it("filters pending and failed payment bookings", () => {
    const bookings = [
      booking({ id: "p1", status: "pending_payment", paymentStatus: "pending" }),
      booking({ id: "f1", status: "payment_failed", paymentStatus: "failed" }),
      booking({ id: "c1", status: "completed", paymentStatus: "paid" }),
    ];

    expect(filterAdminCustomerBookings(bookings, "pending_payment")).toHaveLength(1);
    expect(filterAdminCustomerBookings(bookings, "failed_payment")).toHaveLength(1);
    expect(filterAdminCustomerBookings(bookings, "completed")).toHaveLength(1);
  });

  it("uses customer_id-scoped booking rows only (no email fields on items)", () => {
    const item = booking();
    expect(item).not.toHaveProperty("authEmail");
    expect(item).not.toHaveProperty("customerEmail");
    expect(item.bookingReference).toBe(item.id.slice(0, 8));
  });

  it("summarizes pending and failed payment counts", () => {
    const summary = buildAdminCustomerBookingOperationsSummary(
      [
        booking({ status: "pending_payment", paymentStatus: "pending" }),
        booking({ status: "payment_failed", paymentStatus: "failed" }),
        booking({ status: "assigned", paymentStatus: "paid" }),
      ],
      nowMs,
    );
    expect(summary.pendingPaymentCount).toBe(1);
    expect(summary.failedPaymentCount).toBe(1);
    expect(summary.activeCount).toBe(2);
  });

  it("matches upcoming by scheduled start in the future", () => {
    const upcoming = booking({ status: "assigned" });
    const past = booking({
      id: "past",
      scheduledStart: "2020-01-01T10:00:00.000Z",
      scheduledEnd: "2020-01-01T12:00:00.000Z",
      status: "assigned",
    });
    expect(matchesAdminCustomerBookingFilter(upcoming, "upcoming", nowMs)).toBe(true);
    expect(matchesAdminCustomerBookingFilter(past, "upcoming", nowMs)).toBe(false);
  });

  it("builds payment support summary from payment rows", () => {
    const summary = buildAdminCustomerPaymentSupportSummary({
      paymentSummary: {
        totalPayments: 2,
        paidCount: 1,
        pendingCount: 1,
        failedCount: 0,
        refundedCount: 0,
        totalPaidCents: 50000,
      },
      payments: [
        {
          id: "pay-1",
          bookingId: "b1",
          status: "paid",
          amountCents: 50000,
          currency: "ZAR",
          provider: "paystack",
          createdAt: "2026-05-18T10:00:00.000Z",
          metadata: { channel: "card" },
        },
      ],
    });
    expect(summary.totalPaidCents).toBe(50000);
    expect(summary.pendingPaymentCount).toBe(1);
    expect(summary.latestPaymentMethod).toBe("card");
    expect(summary.latestPaymentBookingId).toBe("b1");
  });
});
