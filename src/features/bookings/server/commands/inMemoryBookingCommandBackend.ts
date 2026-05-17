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
import type { BookingCommandBackend, TransitionResult } from "./bookingCommandBackend";
import { buildAuditEnvelope } from "./bookingCommandAudit";
import type { BookingCommand } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function id(): string {
  return crypto.randomUUID();
}

export class InMemoryBookingCommandBackend implements BookingCommandBackend {
  bookings = new Map<string, BookingRow>();
  payments = new Map<string, PaymentRow>();
  offers = new Map<string, AssignmentOfferRow>();
  audits: BookingStateAuditRow[] = [];
  notifications: NotificationOutboxRow[] = [];
  earnings: EarningLineRow[] = [];
  private auditSeq = 1;

  async getBooking(bookingId: string): Promise<BookingRow | null> {
    return this.bookings.get(bookingId) ?? null;
  }

  async getPayment(paymentId: string): Promise<PaymentRow | null> {
    return this.payments.get(paymentId) ?? null;
  }

  async getOffer(offerId: string): Promise<AssignmentOfferRow | null> {
    return this.offers.get(offerId) ?? null;
  }

  async findPaymentByIdempotencyKey(key: string): Promise<PaymentRow | null> {
    for (const p of this.payments.values()) {
      if (p.idempotency_key === key) return p;
    }
    return null;
  }

  async listPaymentsForBooking(bookingId: string): Promise<PaymentRow[]> {
    return [...this.payments.values()].filter((p) => p.booking_id === bookingId);
  }

  async listOffersForBooking(bookingId: string): Promise<AssignmentOfferRow[]> {
    return [...this.offers.values()].filter((o) => o.booking_id === bookingId);
  }

  async findAuditsByBookingAndKey(
    bookingId: string,
    key: string | null | undefined,
  ): Promise<BookingStateAuditRow[]> {
    if (!key) return [];
    return this.audits.filter(
      (a) => a.booking_id === bookingId && a.idempotency_key === key,
    );
  }

  async hasPaidPaymentForBooking(bookingId: string): Promise<boolean> {
    for (const p of this.payments.values()) {
      if (p.booking_id === bookingId && p.status === "paid") return true;
    }
    return false;
  }

  async insertBooking(row: BookingRow): Promise<void> {
    this.bookings.set(row.id, row);
  }

  async updateBookingMetadata(bookingId: string, metadata: Json): Promise<void> {
    const booking = this.bookings.get(bookingId);
    if (!booking) throw new Error("BOOKING_NOT_FOUND");
    booking.metadata = metadata;
    booking.updated_at = nowIso();
    this.bookings.set(bookingId, booking);
  }

  async insertPayment(payment: PaymentRow): Promise<void> {
    this.payments.set(payment.id, payment);
  }

  async insertOffer(offer: AssignmentOfferRow): Promise<void> {
    if (offer.status === "offered") {
      for (const existing of this.offers.values()) {
        if (
          existing.booking_id === offer.booking_id &&
          existing.status === "offered"
        ) {
          throw new Error(
            'duplicate key value violates unique constraint "idx_assignment_offers_one_open_per_booking"',
          );
        }
      }
    }
    this.offers.set(offer.id, offer);
  }

  async updateOffer(offer: AssignmentOfferRow): Promise<void> {
    this.offers.set(offer.id, offer);
  }

  async appendAudit(
    cmd: BookingCommand,
    bookingId: string,
    from: BookingStatus | null,
    to: BookingStatus,
  ): Promise<void> {
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
  }

  async enqueueNotification(channel: string, recipient: string, payload: Json): Promise<void> {
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

  async appendEarningLine(line: Omit<EarningLineRow, "id" | "created_at">): Promise<void> {
    const payoutAmount = line.payout_amount_cents ?? line.amount_cents;
    const row: EarningLineRow = {
      ...line,
      amount_cents: line.amount_cents ?? payoutAmount,
      gross_amount_cents: line.gross_amount_cents ?? payoutAmount,
      payout_amount_cents: payoutAmount,
      payout_status: line.payout_status ?? "pending",
      payout_batch_id: line.payout_batch_id ?? null,
      calculation_metadata: line.calculation_metadata ?? {},
      id: id(),
      created_at: nowIso(),
    };
    this.earnings.push(row);
  }

  async listEarningLinesForBooking(bookingId: string): Promise<EarningLineRow[]> {
    return this.earnings.filter((e) => e.booking_id === bookingId);
  }

  async updateEarningLinesPayoutStatus(
    bookingId: string,
    from: EarningLineRow["payout_status"],
    to: EarningLineRow["payout_status"],
    payoutBatchId?: string | null,
  ): Promise<number> {
    let count = 0;
    for (let i = 0; i < this.earnings.length; i++) {
      const line = this.earnings[i]!;
      if (line.booking_id !== bookingId || line.payout_status !== from) continue;
      this.earnings[i] = {
        ...line,
        payout_status: to,
        payout_batch_id: payoutBatchId ?? line.payout_batch_id,
      };
      count++;
    }
    return count;
  }

  async finalizePaymentSuccess(
    cmd: BookingCommand & { type: "FINALIZE_PAYMENT_SUCCESS" },
    bookingId: string,
    paymentId: string,
  ): Promise<TransitionResult> {
    if ((await this.findAuditsByBookingAndKey(bookingId, cmd.idempotencyKey)).length) {
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
    await this.appendAudit(cmd, booking.id, from, "confirmed");
    return { status: "confirmed", idempotent: false };
  }

  async recordPaymentFailure(
    cmd: BookingCommand & { type: "MARK_PAYMENT_FAILED" },
    bookingId: string,
    paymentId: string,
  ): Promise<TransitionResult> {
    if (
      cmd.idempotencyKey &&
      (await this.findAuditsByBookingAndKey(bookingId, cmd.idempotencyKey)).length
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
    await this.appendAudit(cmd, booking.id, from, "payment_failed");
    return { status: "payment_failed", idempotent: false };
  }

  async expireAssignmentOffer(
    cmd: BookingCommand & { type: "EXPIRE_ASSIGNMENT_OFFER" },
    bookingId: string,
    offerId: string,
  ): Promise<TransitionResult> {
    const booking = this.bookings.get(bookingId);
    const offer = this.offers.get(offerId);
    if (!booking || !offer || offer.booking_id !== booking.id) {
      throw new Error("OFFER_NOT_FOUND");
    }
    if (offer.status !== "offered") {
      throw new Error("OFFER_NOT_OPEN");
    }

    const prior = { ...offer };
    const expired: AssignmentOfferRow = {
      ...offer,
      status: "expired",
      updated_at: cmd.expiredAt,
    };
    await this.updateOffer(expired);

    const auditCmd: BookingCommand = {
      ...cmd,
      metadata: {
        offerId,
        cleanerId: cmd.cleanerId,
        expiredAt: cmd.expiredAt,
        expirySource: "cron",
        previousOfferStatus: "offered",
        ...(cmd.metadata && typeof cmd.metadata === "object" ? cmd.metadata : {}),
      },
    };

    try {
      await this.appendAudit(auditCmd, booking.id, booking.status, booking.status);
    } catch (err) {
      await this.updateOffer(prior);
      throw err;
    }

    return { status: booking.status, idempotent: false };
  }

  async applyTransition(
    cmd: BookingCommand,
    bookingId: string,
    from: BookingStatus,
    to: BookingStatus,
    cleanerId?: string | null,
  ): Promise<TransitionResult> {
    if (
      cmd.idempotencyKey &&
      (await this.findAuditsByBookingAndKey(bookingId, cmd.idempotencyKey)).length
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
    await this.appendAudit(cmd, booking.id, from, to);
    return { status: to, idempotent: false };
  }

  async adminOverrideStatus(
    cmd: BookingCommand & { type: "ADMIN_OVERRIDE_STATUS" },
    booking: BookingRow,
  ): Promise<BookingStatus> {
    const from = booking.status;
    booking.status = cmd.nextStatus;
    booking.updated_at = nowIso();
    this.bookings.set(booking.id, booking);
    await this.appendAudit(cmd, booking.id, from, cmd.nextStatus);
    return cmd.nextStatus;
  }
}
