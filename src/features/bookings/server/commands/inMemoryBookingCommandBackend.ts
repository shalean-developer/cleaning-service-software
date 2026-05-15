import type {
  AssignmentOfferRow,
  BookingRow,
  BookingStateAuditRow,
  Json,
  PaymentRow,
  NotificationOutboxRow,
  EarningLineRow,
} from "@/lib/database/types";
import type { BookingStatus } from "../types";
import { buildAuditEnvelope } from "./bookingCommandAudit";
import type { BookingCommand } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function id(): string {
  return crypto.randomUUID();
}

export class InMemoryBookingCommandBackend {
  bookings = new Map<string, BookingRow>();
  payments = new Map<string, PaymentRow>();
  offers = new Map<string, AssignmentOfferRow>();
  audits: BookingStateAuditRow[] = [];
  notifications: NotificationOutboxRow[] = [];
  earnings: EarningLineRow[] = [];
  private auditSeq = 1;

  findAuditsByBookingAndKey(
    bookingId: string,
    key: string | null | undefined,
  ): BookingStateAuditRow[] {
    if (!key) return [];
    return this.audits.filter(
      (a) => a.booking_id === bookingId && a.idempotency_key === key,
    );
  }

  appendAudit(
    cmd: BookingCommand,
    bookingId: string,
    from: BookingStatus | null,
    to: BookingStatus,
  ): BookingStateAuditRow {
    const env = buildAuditEnvelope(cmd, from, to);
    const row: BookingStateAuditRow = {
      id: this.auditSeq++,
      booking_id: bookingId,
      from_status: from,
      to_status: to,
      command: env.commandName,
      actor_profile_id: cmd.actor.profileId,
      payload: env.payload,
      created_at: nowIso(),
      actor_type: cmd.actor.actorType,
      reason: cmd.reason ?? null,
      idempotency_key: cmd.idempotencyKey ?? null,
      metadata: env.metadata,
    };
    this.audits.push(row);
    return row;
  }

  enqueueNotification(channel: string, recipient: string, payload: Json): void {
    const ts = nowIso();
    this.notifications.push({
      id: id(),
      channel,
      recipient,
      payload,
      status: "pending",
      attempts: 0,
      next_retry_at: null,
      last_error: null,
      created_at: ts,
      updated_at: ts,
    });
  }

  appendEarningLine(line: Omit<EarningLineRow, "id" | "created_at">): EarningLineRow {
    const row: EarningLineRow = {
      ...line,
      id: id(),
      created_at: nowIso(),
    };
    this.earnings.push(row);
    return row;
  }

  finalizePaymentSuccess(
    cmd: BookingCommand & { type: "FINALIZE_PAYMENT_SUCCESS" },
    bookingId: string,
    paymentId: string,
  ): { status: BookingStatus; idempotent: boolean } {
    if (this.findAuditsByBookingAndKey(bookingId, cmd.idempotencyKey).length) {
      const b = this.bookings.get(bookingId)!;
      return { status: b.status, idempotent: true };
    }
    const booking = this.bookings.get(bookingId);
    const payment = this.payments.get(paymentId);
    if (!booking || !payment || payment.booking_id !== booking.id) {
      throw new Error("BOOKING_OR_PAYMENT_NOT_FOUND");
    }
    if (booking.status !== "pending_payment") {
      throw new Error("INVALID_STATE_FOR_FINALIZE");
    }
    if (payment.status === "paid") {
      const b = this.bookings.get(bookingId)!;
      return { status: b.status, idempotent: true };
    }
    payment.status = "paid";
    payment.updated_at = nowIso();
    this.payments.set(payment.id, payment);
    const from = booking.status;
    booking.status = "confirmed";
    booking.updated_at = nowIso();
    this.bookings.set(booking.id, booking);
    this.appendAudit(cmd, booking.id, from, "confirmed");
    return { status: "confirmed", idempotent: false };
  }

  recordPaymentFailure(
    cmd: BookingCommand & { type: "MARK_PAYMENT_FAILED" },
    bookingId: string,
    paymentId: string,
  ): { status: BookingStatus; idempotent: boolean } {
    if (
      cmd.idempotencyKey &&
      this.findAuditsByBookingAndKey(bookingId, cmd.idempotencyKey).length
    ) {
      return { status: this.bookings.get(bookingId)!.status, idempotent: true };
    }
    const booking = this.bookings.get(bookingId);
    const payment = this.payments.get(paymentId);
    if (!booking || !payment || payment.booking_id !== booking.id) {
      throw new Error("BOOKING_OR_PAYMENT_NOT_FOUND");
    }
    payment.status = "failed";
    payment.updated_at = nowIso();
    this.payments.set(payment.id, payment);
    const from = booking.status;
    booking.status = "payment_failed";
    booking.updated_at = nowIso();
    this.bookings.set(booking.id, booking);
    this.appendAudit(cmd, booking.id, from, "payment_failed");
    return { status: "payment_failed", idempotent: false };
  }

  applyTransition(
    cmd: BookingCommand,
    bookingId: string,
    from: BookingStatus,
    to: BookingStatus,
    cleanerId?: string | null,
  ): { status: BookingStatus; idempotent: boolean } {
    if (
      cmd.idempotencyKey &&
      this.findAuditsByBookingAndKey(bookingId, cmd.idempotencyKey).length
    ) {
      return { status: this.bookings.get(bookingId)!.status, idempotent: true };
    }
    const booking = this.bookings.get(bookingId);
    if (!booking) throw new Error("BOOKING_NOT_FOUND");
    if (booking.status !== from) {
      throw new Error("BOOKING_STATUS_CONFLICT");
    }
    booking.status = to;
    booking.updated_at = nowIso();
    if (cleanerId) booking.cleaner_id = cleanerId;
    this.bookings.set(booking.id, booking);
    this.appendAudit(cmd, booking.id, from, to);
    return { status: to, idempotent: false };
  }
}
