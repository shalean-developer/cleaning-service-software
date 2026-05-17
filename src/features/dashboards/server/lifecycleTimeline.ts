import type { BookingStateAuditRow, PaymentRow } from "@/lib/database/types";
import type { BookingStatus } from "@/features/bookings/server/types";
import {
  labelForCustomerBookingStatus,
  type PaymentFailureReason,
} from "@/features/bookings/server/paymentFailureDisplay";
import { labelForBookingStatus } from "@/features/bookings/server/statusLabels";
import {
  auditEventDetail,
  humanAuditCommandTitle,
  humanAuditStatusTitle,
  humanPaymentEventTitle,
} from "./lifecycleTimelinePresentation";

export type LifecycleAudience = "admin" | "customer" | "cleaner";

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
  audience?: LifecycleAudience;
}): LifecycleEvent[] {
  const audience = params.audience ?? "admin";
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
      title: humanPaymentEventTitle(payment.status, audience),
      detail: payment.provider_ref ? `Ref ${payment.provider_ref}` : null,
      kind: "payment",
    });
  }

  for (const audit of params.audits) {
    if (!audit.to_status) continue;
    const toStatus = audit.to_status as BookingStatus;
    const commandTitle = humanAuditCommandTitle(
      audit.command,
      toStatus,
      audience,
      params.paymentFailureReason,
    );
    const title =
      commandTitle ??
      (audience === "admin" && toStatus === "payment_failed"
        ? labelForCustomerBookingStatus("payment_failed", params.paymentFailureReason)
        : humanAuditStatusTitle(toStatus, audience, params.paymentFailureReason));
    events.push({
      id: `audit-${audit.id}`,
      at: audit.created_at,
      title,
      detail: auditEventDetail(audit.command, audience),
      kind: "audit",
    });
  }

  const currentLabel =
    audience === "customer"
      ? labelForCustomerBookingStatus(params.bookingStatus, params.paymentFailureReason)
      : audience === "admin" && params.bookingStatus === "payment_failed"
        ? labelForCustomerBookingStatus("payment_failed", params.paymentFailureReason)
        : labelForBookingStatus(params.bookingStatus);

  events.push({
    id: "current",
    at: params.updatedAt,
    title: `Current: ${currentLabel}`,
    detail: null,
    kind: "booking",
  });

  return events.sort((a, b) => a.at.localeCompare(b.at));
}
