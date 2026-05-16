import type { BookingStateAuditRow, PaymentRow } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  labelForCustomerBookingStatus,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import { labelForBookingStatus, labelForPaymentStatus } from "@/features/bookings/server/statusLabels";

export type LifecycleEvent = {
  id: string;
  at: string;
  title: string;
  detail: string | null;
  kind: "booking" | "payment" | "audit";
};

export function buildLifecycleTimeline(params: {
  bookingStatus: BookingStatus;
  createdAt: string;
  updatedAt: string;
  payments: PaymentRow[];
  audits: BookingStateAuditRow[];
  paymentFailureReason?: PaymentFailureReason;
}): LifecycleEvent[] {
  const events: LifecycleEvent[] = [
    {
      id: "created",
      at: params.createdAt,
      title: "Booking created",
      detail: null,
      kind: "booking",
    },
  ];

  for (const payment of params.payments) {
    events.push({
      id: `payment-${payment.id}`,
      at: payment.updated_at,
      title: `Payment ${labelForPaymentStatus(payment.status).toLowerCase()}`,
      detail: payment.provider_ref ? `Ref ${payment.provider_ref}` : null,
      kind: "payment",
    });
  }

  for (const audit of params.audits) {
    if (!audit.to_status) continue;
    const title =
      audit.to_status === "payment_failed"
        ? labelForCustomerBookingStatus("payment_failed", params.paymentFailureReason)
        : labelForBookingStatus(audit.to_status);
    events.push({
      id: `audit-${audit.id}`,
      at: audit.created_at,
      title,
      detail: audit.command ?? null,
      kind: "audit",
    });
  }

  events.push({
    id: "current",
    at: params.updatedAt,
    title: `Current: ${labelForCustomerBookingStatus(params.bookingStatus, params.paymentFailureReason)}`,
    detail: null,
    kind: "booking",
  });

  return events.sort((a, b) => a.at.localeCompare(b.at));
}
