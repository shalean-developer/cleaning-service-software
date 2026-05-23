import { describe, expect, it } from "vitest";
import type { BookingStateAuditRow, PaymentRow } from "@/lib/database/types";
import { buildLifecycleTimeline } from "./lifecycleTimeline";

const baseParams = {
  bookingStatus: "assigned" as const,
  createdAt: "2026-05-10T08:00:00.000Z",
  updatedAt: "2026-05-12T10:00:00.000Z",
  payments: [] as PaymentRow[],
  audits: [] as BookingStateAuditRow[],
};

function auditRow(
  partial: Pick<BookingStateAuditRow, "id" | "to_status" | "command" | "created_at"> &
    Partial<BookingStateAuditRow>,
): BookingStateAuditRow {
  return {
    booking_id: "b1",
    from_status: "pending_payment",
    actor_profile_id: null,
    payload: {},
    actor_type: "system",
    reason: null,
    idempotency_key: null,
    metadata: null,
    ...partial,
  };
}

function paymentRow(partial: Partial<PaymentRow> & Pick<PaymentRow, "id" | "status">): PaymentRow {
  return {
    booking_id: "b1",
    amount_cents: 10000,
    currency: "ZAR",
    provider: "paystack",
    provider_ref: "ref-1",
    idempotency_key: "idem-1",
    payment_link_expires_at: null,
    metadata: null,
    created_at: "2026-05-10T08:30:00.000Z",
    updated_at: "2026-05-10T08:30:00.000Z",
    ...partial,
  };
}

describe("buildLifecycleTimeline", () => {
  it("keeps audit command in detail for admin audience", () => {
    const events = buildLifecycleTimeline({
      ...baseParams,
      audience: "admin",
      audits: [
        auditRow({
          id: 1,
          to_status: "payment_failed",
          command: "MARK_PAYMENT_FAILED",
          created_at: "2026-05-11T09:00:00.000Z",
        }),
      ],
    });
    const audit = events.find((e) => e.kind === "audit");
    expect(audit?.detail).toBe("MARK_PAYMENT_FAILED");
  });

  it("does not expose raw command strings for customer audience", () => {
    const events = buildLifecycleTimeline({
      ...baseParams,
      bookingStatus: "payment_failed",
      audience: "customer",
      audits: [
        auditRow({
          id: 2,
          to_status: "payment_failed",
          command: "MARK_PAYMENT_FAILED",
          created_at: "2026-05-11T09:00:00.000Z",
        }),
      ],
    });
    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain("MARK_PAYMENT_FAILED");
    const audit = events.find((e) => e.kind === "audit");
    expect(audit?.title).toBe("Payment not completed");
    expect(audit?.detail).toBeNull();
  });

  it("uses human payment confirmed label for customer payments", () => {
    const events = buildLifecycleTimeline({
      ...baseParams,
      audience: "customer",
      payments: [paymentRow({ id: "pay-1", status: "paid" })],
    });
    const payment = events.find((e) => e.kind === "payment");
    expect(payment?.title).toBe("Payment confirmed");
    expect(payment?.detail).toBe("Ref ref-1");
  });

  it("uses human labels for cleaner audience without command detail", () => {
    const events = buildLifecycleTimeline({
      ...baseParams,
      audience: "cleaner",
      audits: [
        auditRow({
          id: 3,
          from_status: "assigned",
          to_status: "in_progress",
          command: "MARK_IN_PROGRESS",
          actor_type: "cleaner",
          created_at: "2026-05-11T09:00:00.000Z",
        }),
      ],
    });
    expect(JSON.stringify(events)).not.toContain("MARK_IN_PROGRESS");
    const audit = events.find((e) => e.kind === "audit");
    expect(audit?.title).toBe("Cleaning in progress");
  });

  it("shows Completed on customer current status for payout_ready", () => {
    const events = buildLifecycleTimeline({
      ...baseParams,
      bookingStatus: "payout_ready",
      audience: "customer",
    });
    const current = events.find((e) => e.id === "current");
    expect(current?.title).toBe("Current: Completed");
  });
});
