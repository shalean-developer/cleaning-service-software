import { offerTeamRole } from "@/features/assignments/server/offerTeamRole";
import type { CleanerLifecycleSnapshot } from "@/features/cleaners/server/lifecycle/operationalState";
import type {
  AssignmentOfferRow,
  BookingCleanerRole,
  BookingCleanerRow,
  BookingCleanerStatus,
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

const DEFAULT_OPERATIONAL_CLEANER: CleanerLifecycleSnapshot = {
  active: true,
  suspendedAt: null,
  deletedAt: null,
  onboardingCompletedAt: "2024-01-01T00:00:00.000Z",
};

export class InMemoryBookingCommandBackend implements BookingCommandBackend {
  bookings = new Map<string, BookingRow>();
  /** Per-cleaner lifecycle overrides for command guard tests. */
  cleanerLifecycleById = new Map<string, CleanerLifecycleSnapshot>();
  payments = new Map<string, PaymentRow>();
  offers = new Map<string, AssignmentOfferRow>();
  bookingCleaners = new Map<string, BookingCleanerRow>();
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

  /** booking ids with active monthly service authorization (tests). */
  monthlyServiceAuthorizedBookingIds = new Set<string>();

  async hasFinancialClearanceForCompletion(bookingId: string): Promise<boolean> {
    if (await this.hasPaidPaymentForBooking(bookingId)) return true;
    return this.monthlyServiceAuthorizedBookingIds.has(bookingId);
  }

  setCleanerLifecycle(cleanerId: string, snapshot: CleanerLifecycleSnapshot): void {
    this.cleanerLifecycleById.set(cleanerId, snapshot);
  }

  async getCleanerLifecycleSnapshot(
    cleanerId: string,
  ): Promise<CleanerLifecycleSnapshot | null> {
    return this.cleanerLifecycleById.get(cleanerId) ?? DEFAULT_OPERATIONAL_CLEANER;
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

  async updateBookingSchedule(
    bookingId: string,
    scheduledStart: string,
    scheduledEnd: string,
  ): Promise<void> {
    const booking = this.bookings.get(bookingId);
    if (!booking) throw new Error("BOOKING_NOT_FOUND");
    booking.scheduled_start = scheduledStart;
    booking.scheduled_end = scheduledEnd;
    booking.updated_at = nowIso();
    this.bookings.set(bookingId, booking);
  }

  async releaseAssignedCleanerForReschedule(
    bookingId: string,
    fromStatus: BookingStatus,
  ): Promise<void> {
    const booking = this.bookings.get(bookingId);
    if (!booking || booking.status !== fromStatus || fromStatus !== "assigned") {
      throw new Error("UNASSIGN_NOT_APPLICABLE");
    }
    if (!booking.cleaner_id) throw new Error("UNASSIGN_NOT_APPLICABLE");
    const cleanerId = booking.cleaner_id;
    booking.cleaner_id = null;
    booking.status = "pending_assignment";
    booking.updated_at = nowIso();
    this.bookings.set(bookingId, booking);
    for (const row of this.bookingCleaners.values()) {
      if (
        row.booking_id === bookingId &&
        row.cleaner_id === cleanerId &&
        row.status === "accepted"
      ) {
        this.bookingCleaners.set(row.id, {
          ...row,
          status: "removed",
          updated_at: nowIso(),
        });
      }
    }
  }

  async updateAssignmentDispatchAt(
    bookingId: string,
    assignmentDispatchAt: string | null,
  ): Promise<void> {
    const booking = this.bookings.get(bookingId);
    if (!booking) throw new Error("BOOKING_NOT_FOUND");
    booking.assignment_dispatch_at = assignmentDispatchAt;
    booking.updated_at = nowIso();
    this.bookings.set(bookingId, booking);
  }

  async insertPayment(payment: PaymentRow): Promise<void> {
    this.payments.set(payment.id, payment);
  }

  async insertOffer(offer: AssignmentOfferRow): Promise<void> {
    if (offer.status === "offered") {
      const slot = offerTeamRole(offer);
      for (const existing of this.offers.values()) {
        if (
          existing.booking_id === offer.booking_id &&
          existing.status === "offered" &&
          offerTeamRole(existing) === slot
        ) {
          throw new Error(
            'duplicate key value violates unique constraint "idx_assignment_offers_one_open_per_booking_team_role"',
          );
        }
      }
    }
    this.offers.set(offer.id, offer);
  }

  async updateOffer(offer: AssignmentOfferRow): Promise<void> {
    this.offers.set(offer.id, offer);
  }

  async listBookingCleanersForBooking(bookingId: string): Promise<BookingCleanerRow[]> {
    return [...this.bookingCleaners.values()].filter((r) => r.booking_id === bookingId);
  }

  async upsertBookingCleanerRoster(params: {
    bookingId: string;
    cleanerId: string;
    role: BookingCleanerRole;
    status: BookingCleanerStatus;
    assignedByProfileId?: string | null;
  }): Promise<BookingCleanerRow> {
    const ts = nowIso();
    for (const row of this.bookingCleaners.values()) {
      if (row.booking_id === params.bookingId && row.cleaner_id === params.cleanerId) {
        const updated: BookingCleanerRow = {
          ...row,
          role: params.role,
          status: params.status,
          assigned_by_profile_id:
            params.assignedByProfileId ?? row.assigned_by_profile_id,
          support_completed_at: row.support_completed_at ?? null,
          support_note: row.support_note ?? null,
          updated_at: ts,
        };
        this.bookingCleaners.set(row.id, updated);
        return updated;
      }
    }
    const row: BookingCleanerRow = {
      id: id(),
      booking_id: params.bookingId,
      cleaner_id: params.cleanerId,
      role: params.role,
      status: params.status,
      assigned_by_profile_id: params.assignedByProfileId ?? null,
      support_completed_at: null,
      support_note: null,
      created_at: ts,
      updated_at: ts,
    };
    this.bookingCleaners.set(row.id, row);
    return row;
  }

  async updateBookingCleanerRosterStatus(
    rosterId: string,
    status: BookingCleanerStatus,
  ): Promise<void> {
    const row = this.bookingCleaners.get(rosterId);
    if (!row) throw new Error("ROSTER_NOT_FOUND");
    this.bookingCleaners.set(rosterId, {
      ...row,
      status,
      updated_at: nowIso(),
    });
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
      team_earning_role: line.team_earning_role ?? null,
      team_earning_source: line.team_earning_source ?? null,
      id: id(),
      created_at: nowIso(),
    };
    this.earnings.push(row);
  }

  async listEarningLinesForBooking(bookingId: string): Promise<EarningLineRow[]> {
    return this.earnings.filter((e) => e.booking_id === bookingId);
  }

  async updateEarningLinePayoutAmount(
    bookingId: string,
    lineId: string,
    payoutAmountCents: number,
    teamMetadata?: {
      team_earning_role?: EarningLineRow["team_earning_role"];
      team_earning_source?: EarningLineRow["team_earning_source"];
    },
  ): Promise<boolean> {
    const index = this.earnings.findIndex(
      (line) => line.booking_id === bookingId && line.id === lineId,
    );
    if (index < 0) return false;
    const line = this.earnings[index]!;
    if (line.payout_status !== "pending") return false;

    this.earnings[index] = {
      ...line,
      amount_cents: payoutAmountCents,
      payout_amount_cents: payoutAmountCents,
      team_earning_role: teamMetadata?.team_earning_role ?? line.team_earning_role,
      team_earning_source: teamMetadata?.team_earning_source ?? line.team_earning_source,
      calculation_metadata: {
        ...(line.calculation_metadata as Record<string, unknown>),
        trueUpAdjustedAt: nowIso(),
        trueUpExpectedShareCents: payoutAmountCents,
      } as EarningLineRow["calculation_metadata"],
    };
    return true;
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
