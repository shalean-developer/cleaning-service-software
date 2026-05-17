import type { AssignmentOfferRow, BookingRow, Json } from "@/lib/database/types";
import { mergeBookingMetadataAssignment } from "@/features/assignments/server/assignmentMetadata";
import { markBookingEarningsPaid } from "@/features/earnings/server/markPaidOut";
import { markBookingEarningsPayoutReady } from "@/features/earnings/server/markPayoutReady";
import { recordEarningsForBooking } from "@/features/earnings/server/recordEarningsForBooking";
import type { BookingId, BookingStatus } from "../types";
import { BOOKING_STATUSES } from "../types";
import {
  assertActorAuthorizedForCommand,
  assertTransitionShape,
} from "./bookingCommandGuards";
import type { BookingCommandBackend } from "./bookingCommandBackend";
import type {
  BookingCommand,
  BookingCommandFailure,
  BookingCommandResult,
} from "./types";
import { enqueueNotificationWhenNotIdempotent } from "./shouldEnqueueNotificationForCommandResult";

export type BookingCommandRunContext = {
  /**
   * Resolved customers.id for the current profile when the actor is a customer.
   * Required for customer-scoped commands against an existing booking.
   */
  actingCustomerId?: string | null;
  /**
   * Resolved cleaners.id for the current profile when the actor is a cleaner.
   */
  actingCleanerId?: string | null;
};

function fail(
  code: BookingCommandFailure["code"],
  message: string,
): BookingCommandResult {
  return { ok: false, code, message };
}

function ok(
  bookingId: BookingId,
  status: BookingStatus,
  idempotent: boolean,
): BookingCommandResult {
  return { ok: true, bookingId, status, idempotent };
}

function assertCustomerOwnsBooking(
  cmd: BookingCommand,
  booking: { customer_id: string },
  ctx: BookingCommandRunContext | undefined,
): BookingCommandResult | null {
  if (cmd.actor.actorType !== "customer") return null;
  if (!ctx?.actingCustomerId) {
    return fail(
      "FORBIDDEN",
      "Customer actor requires actingCustomerId in the run context.",
    );
  }
  if (booking.customer_id !== ctx.actingCustomerId) {
    return fail("FORBIDDEN", "Customer cannot act on another customer's booking.");
  }
  return null;
}

function isOfferExpired(offer: { expires_at: string | null }): boolean {
  if (!offer.expires_at) return false;
  return new Date(offer.expires_at).getTime() <= Date.now();
}

function isOfferPastExpiryAt(
  offer: { expires_at: string | null },
  expiredAtIso: string,
): boolean {
  if (!offer.expires_at) return false;
  return new Date(offer.expires_at).getTime() <= new Date(expiredAtIso).getTime();
}

function isOpenOfferUniqueViolation(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("idx_assignment_offers_one_open_per_booking") ||
    msg.includes("duplicate key") ||
    msg.includes("23505")
  );
}

async function expireOtherOpenOffers(
  backend: BookingCommandBackend,
  bookingId: string,
  exceptOfferId: string,
): Promise<void> {
  const offers = await backend.listOffersForBooking(bookingId);
  const now = new Date().toISOString();
  for (const o of offers) {
    if (o.id === exceptOfferId || o.status !== "offered") continue;
    await backend.updateOffer({
      ...o,
      status: "cancelled",
      responded_at: now,
      updated_at: now,
    });
  }
}

function assertCleanerIs(
  cmd: BookingCommand,
  cleanerId: string,
  ctx: BookingCommandRunContext | undefined,
): BookingCommandResult | null {
  if (cmd.actor.actorType !== "cleaner") return null;
  if (!ctx?.actingCleanerId) {
    return fail(
      "FORBIDDEN",
      "Cleaner actor requires actingCleanerId in the run context.",
    );
  }
  if (ctx.actingCleanerId !== cleanerId) {
    return fail("FORBIDDEN", "Cleaner cannot act on another cleaner's assignment.");
  }
  return null;
}

/**
 * Central booking command executor. Guards run in-process; persistence is delegated
 * to the injected {@link BookingCommandBackend} (in-memory for unit tests, Supabase for production).
 */
export async function executeBookingCommand(
  backend: BookingCommandBackend,
  cmd: BookingCommand,
  ctx?: BookingCommandRunContext,
): Promise<BookingCommandResult> {
  const authz = assertActorAuthorizedForCommand(cmd);
  if (authz) return authz;

  switch (cmd.type) {
    case "CREATE_BOOKING_DRAFT": {
      if (cmd.actor.actorType === "customer" && cmd.customerId !== ctx?.actingCustomerId) {
        return fail(
          "FORBIDDEN",
          "Customer may only create drafts for their own customer id.",
        );
      }
      const bid = crypto.randomUUID();
      const ts = new Date().toISOString();
      try {
        await backend.insertBooking({
          id: bid,
          customer_id: cmd.customerId,
          cleaner_id: null,
          service_id: cmd.serviceId ?? null,
          status: "draft",
          scheduled_start: cmd.scheduledStart,
          scheduled_end: cmd.scheduledEnd,
          price_cents: cmd.priceCents,
          currency: cmd.currency ?? "USD",
          series_id: null,
          metadata: (cmd.metadata ?? {}) as BookingRow["metadata"],
          created_at: ts,
          updated_at: ts,
        });
        await backend.appendAudit(cmd, bid, null, "draft");
        await enqueueNotificationWhenNotIdempotent(backend, false, "email", cmd.customerId, {
          template: "booking_draft_created",
          bookingId: bid,
        });
        return ok(bid, "draft", false);
      } catch {
        return fail("PERSISTENCE_ERROR", "Could not create booking draft.");
      }
    }

    case "MARK_PAYMENT_PENDING": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const own = assertCustomerOwnsBooking(cmd, booking, ctx);
      if (own) return own;

      const existingPayment = await backend.findPaymentByIdempotencyKey(
        cmd.paymentIdempotencyKey,
      );
      if (existingPayment) {
        if (existingPayment.booking_id !== cmd.bookingId) {
          return fail(
            "INVALID_PAYLOAD",
            "paymentIdempotencyKey already belongs to another booking.",
          );
        }
        if (booking.status === "pending_payment") {
          return ok(booking.id, "pending_payment", true);
        }
      }

      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;

      const paymentId = crypto.randomUUID();
      const paymentTs = new Date().toISOString();
      try {
        await backend.insertPayment({
          id: paymentId,
          booking_id: booking.id,
          status: "pending",
          provider: cmd.provider ?? "paystack",
          provider_ref: null,
          idempotency_key: cmd.paymentIdempotencyKey,
          amount_cents: booking.price_cents,
          currency: booking.currency,
          payment_link_expires_at: null,
          metadata: {},
          created_at: paymentTs,
          updated_at: paymentTs,
        });
        const r = await backend.applyTransition(
          cmd,
          booking.id,
          booking.status,
          "pending_payment",
        );
        await enqueueNotificationWhenNotIdempotent(
          backend,
          r.idempotent,
          "email",
          booking.customer_id,
          {
            template: "payment_pending",
            bookingId: booking.id,
          },
        );
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Could not move booking to pending_payment.");
      }
    }

    case "FINALIZE_PAYMENT_SUCCESS": {
      if (!cmd.idempotencyKey?.trim()) {
        return fail("IDEMPOTENCY_REQUIRED", "FINALIZE_PAYMENT_SUCCESS requires idempotencyKey.");
      }
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      if (
        (await backend.findAuditsByBookingAndKey(cmd.bookingId, cmd.idempotencyKey)).length > 0
      ) {
        return ok(booking.id, booking.status, true);
      }
      const payment = await backend.getPayment(cmd.paymentId);
      if (!payment || payment.booking_id !== booking.id) {
        return fail("PAYMENT_NOT_FOUND", "Payment not found for this booking.");
      }
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;

      try {
        const r = await backend.finalizePaymentSuccess(cmd, booking.id, payment.id);
        await enqueueNotificationWhenNotIdempotent(
          backend,
          r.idempotent,
          "email",
          booking.customer_id,
          {
            template: "payment_confirmed",
            bookingId: booking.id,
          },
        );
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Payment finalization failed.");
      }
    }

    case "MARK_PAYMENT_FAILED": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const payment = await backend.getPayment(cmd.paymentId);
      if (!payment || payment.booking_id !== booking.id) {
        return fail("PAYMENT_NOT_FOUND", "Payment not found for this booking.");
      }
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;

      try {
        const r = await backend.recordPaymentFailure(cmd, booking.id, payment.id);
        await enqueueNotificationWhenNotIdempotent(
          backend,
          r.idempotent,
          "email",
          booking.customer_id,
          {
            template: "payment_failed",
            bookingId: booking.id,
          },
        );
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Recording payment failure failed.");
      }
    }

    case "MOVE_TO_PENDING_ASSIGNMENT": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      if (!(await backend.hasPaidPaymentForBooking(booking.id))) {
        return fail(
          "PAYMENT_NOT_PAID",
          "Cannot enter pending_assignment until at least one payment is paid for this booking.",
        );
      }
      try {
        const r = await backend.applyTransition(
          cmd,
          booking.id,
          "confirmed",
          "pending_assignment",
        );
        await enqueueNotificationWhenNotIdempotent(
          backend,
          r.idempotent,
          "email",
          booking.customer_id,
          {
            template: "pending_assignment",
            bookingId: booking.id,
          },
        );
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Move to pending_assignment failed.");
      }
    }

    case "OFFER_TO_CLEANER": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      if (booking.cleaner_id && booking.cleaner_id !== cmd.cleanerId) {
        return fail(
          "ASSIGNMENT_CONFLICT",
          "Booking is already assigned to another cleaner.",
        );
      }

      const nowIso = new Date().toISOString();
      let existingOffers = await backend.listOffersForBooking(booking.id);

      for (const existing of existingOffers) {
        if (existing.status !== "offered" || !isOfferExpired(existing)) continue;
        await backend.updateOffer({
          ...existing,
          status: "expired",
          updated_at: nowIso,
        });
      }

      existingOffers = await backend.listOffersForBooking(booking.id);

      for (const existing of existingOffers) {
        if (existing.cleaner_id !== cmd.cleanerId) continue;
        if (existing.status === "accepted") {
          return ok(booking.id, booking.status, true);
        }
        if (existing.status === "offered") {
          return ok(booking.id, booking.status, true);
        }
      }

      const otherOpenOffer = existingOffers.find(
        (o) => o.status === "offered" && o.cleaner_id !== cmd.cleanerId,
      );
      if (otherOpenOffer) {
        return fail(
          "OPEN_OFFER_EXISTS",
          "Booking already has an open assignment offer to another cleaner.",
        );
      }

      const ts = nowIso;
      const oid = crypto.randomUUID();
      try {
        await backend.insertOffer({
          id: oid,
          booking_id: booking.id,
          cleaner_id: cmd.cleanerId,
          status: "offered",
          offered_at: ts,
          responded_at: null,
          expires_at: cmd.expiresAt ?? null,
          created_at: ts,
          updated_at: ts,
        });
        await enqueueNotificationWhenNotIdempotent(backend, false, "push", cmd.cleanerId, {
          template: "assignment_offer",
          bookingId: booking.id,
          offerId: oid,
        });
        return ok(booking.id, booking.status, false);
      } catch (err) {
        if (isOpenOfferUniqueViolation(err)) {
          return fail(
            "OPEN_OFFER_EXISTS",
            "Booking already has an open assignment offer.",
          );
        }
        return fail("PERSISTENCE_ERROR", "Could not create assignment offer.");
      }
    }

    case "DECLINE_CLEANER_ASSIGNMENT": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      const offer = await backend.getOffer(cmd.offerId);
      if (!offer || offer.booking_id !== booking.id) {
        return fail("OFFER_NOT_FOUND", "Offer not found for this booking.");
      }
      const cln = assertCleanerIs(cmd, offer.cleaner_id, ctx);
      if (cln) return cln;
      if (offer.status === "declined") {
        return ok(booking.id, booking.status, true);
      }
      if (offer.status !== "offered") {
        return fail("OFFER_NOT_OPEN", "Offer is not in offered state.");
      }
      if (isOfferExpired(offer)) {
        const expired: AssignmentOfferRow = {
          ...offer,
          status: "expired",
          updated_at: new Date().toISOString(),
        };
        await backend.updateOffer(expired);
        return fail("OFFER_NOT_OPEN", "Offer has expired.");
      }
      offer.status = "declined";
      offer.responded_at = new Date().toISOString();
      offer.updated_at = offer.responded_at;
      try {
        await backend.updateOffer(offer);
        return ok(booking.id, booking.status, false);
      } catch {
        return fail("PERSISTENCE_ERROR", "Could not decline assignment offer.");
      }
    }

    case "CANCEL_OPEN_ASSIGNMENT_OFFER": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      if (cmd.actor.actorType !== "admin") {
        return fail("FORBIDDEN", "Only admins may cancel open assignment offers.");
      }
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      const offer = await backend.getOffer(cmd.offerId);
      if (!offer || offer.booking_id !== booking.id) {
        return fail("OFFER_NOT_FOUND", "Offer not found for this booking.");
      }
      if (offer.status === "cancelled") {
        try {
          await backend.appendAudit(cmd, booking.id, booking.status, booking.status);
        } catch {
          return fail("PERSISTENCE_ERROR", "Could not record cancel audit.");
        }
        return ok(booking.id, booking.status, true);
      }
      if (offer.status !== "offered") {
        return fail("OFFER_NOT_OPEN", "Offer is not in offered state.");
      }
      const now = new Date().toISOString();
      try {
        await backend.updateOffer({
          ...offer,
          status: "cancelled",
          responded_at: now,
          updated_at: now,
        });
        await backend.appendAudit(cmd, booking.id, booking.status, booking.status);
        return ok(booking.id, booking.status, false);
      } catch {
        return fail("PERSISTENCE_ERROR", "Could not cancel assignment offer.");
      }
    }

    case "ACCEPT_CLEANER_ASSIGNMENT": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const offer = await backend.getOffer(cmd.offerId);
      if (!offer || offer.booking_id !== booking.id) {
        return fail("OFFER_NOT_FOUND", "Offer not found for this booking.");
      }
      const cln = assertCleanerIs(cmd, offer.cleaner_id, ctx);
      if (cln) return cln;
      if (
        offer.status === "accepted" &&
        booking.status === "assigned" &&
        booking.cleaner_id === offer.cleaner_id
      ) {
        return ok(booking.id, booking.status, true);
      }
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      if (booking.status !== "pending_assignment") {
        return fail(
          "ASSIGNMENT_CONFLICT",
          "Booking is not awaiting assignment acceptance.",
        );
      }
      if (offer.status !== "offered") {
        return fail("OFFER_NOT_OPEN", "Offer is not open for acceptance.");
      }
      if (isOfferExpired(offer)) {
        const expired: AssignmentOfferRow = {
          ...offer,
          status: "expired",
          updated_at: new Date().toISOString(),
        };
        await backend.updateOffer(expired);
        return fail("OFFER_NOT_OPEN", "Offer has expired.");
      }
      if (booking.cleaner_id && booking.cleaner_id !== offer.cleaner_id) {
        return fail("ASSIGNMENT_CONFLICT", "Booking already assigned to a different cleaner.");
      }
      try {
        const r = await backend.applyTransition(
          cmd,
          booking.id,
          "pending_assignment",
          "assigned",
          offer.cleaner_id,
        );
        offer.status = "accepted";
        offer.responded_at = new Date().toISOString();
        offer.updated_at = offer.responded_at;
        await backend.updateOffer(offer);
        await expireOtherOpenOffers(backend, booking.id, offer.id);
        await enqueueNotificationWhenNotIdempotent(
          backend,
          r.idempotent,
          "email",
          booking.customer_id,
          {
            template: "cleaner_assigned",
            bookingId: booking.id,
          },
        );
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Accept assignment failed.");
      }
    }

    case "MARK_IN_PROGRESS":
    case "MARK_BOOKING_IN_PROGRESS": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      if (booking.status === "in_progress") {
        return ok(booking.id, booking.status, true);
      }
      if (cmd.actor.actorType === "cleaner") {
        if (!booking.cleaner_id) {
          return fail("ASSIGNMENT_CONFLICT", "No cleaner assigned on this booking.");
        }
        const cln = assertCleanerIs(cmd, booking.cleaner_id, ctx);
        if (cln) return cln;
      }
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      try {
        const r = await backend.applyTransition(cmd, booking.id, "assigned", "in_progress");
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Mark in progress failed.");
      }
    }

    case "MARK_BOOKING_COMPLETED": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      if (!booking.cleaner_id) {
        return fail("ASSIGNMENT_CONFLICT", "No cleaner assigned on this booking.");
      }
      if (cmd.actor.actorType === "cleaner") {
        const cln = assertCleanerIs(cmd, booking.cleaner_id, ctx);
        if (cln) return cln;
      }
      if (!(await backend.hasPaidPaymentForBooking(booking.id))) {
        return fail(
          "PAYMENT_NOT_PAID",
          "Cannot complete booking until payment is confirmed.",
        );
      }
      if (!Number.isFinite(booking.price_cents) || booking.price_cents <= 0) {
        return fail(
          "INVALID_PAYLOAD",
          "Booking total must be positive to complete.",
        );
      }

      if (booking.status === "completed") {
        const earnings = await recordEarningsForBooking(backend, booking);
        if (!earnings.ok) {
          return fail(earnings.code as BookingCommandFailure["code"], earnings.message);
        }
        return ok(booking.id, booking.status, true);
      }

      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;

      try {
        const r = await backend.applyTransition(cmd, booking.id, "in_progress", "completed");
        const fresh = (await backend.getBooking(booking.id)) ?? booking;
        const earnings = await recordEarningsForBooking(backend, fresh);
        if (!earnings.ok) {
          return fail(earnings.code as BookingCommandFailure["code"], earnings.message);
        }
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Mark completed failed.");
      }
    }

    case "MARK_BOOKING_PAYOUT_READY": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      if (booking.status === "payout_ready") {
        return ok(booking.id, booking.status, true);
      }
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;

      const earningsReady = await markBookingEarningsPayoutReady(backend, booking.id);
      if (!earningsReady.ok) {
        return fail(earningsReady.code as BookingCommandFailure["code"], earningsReady.message);
      }

      try {
        const r = await backend.applyTransition(cmd, booking.id, "completed", "payout_ready");
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Mark payout-ready failed.");
      }
    }

    case "MARK_BOOKING_PAID_OUT": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      if (booking.status === "paid_out") {
        return ok(booking.id, booking.status, true);
      }
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;

      const paid = await markBookingEarningsPaid(
        backend,
        booking.id,
        cmd.payoutBatchId ?? null,
      );
      if (!paid.ok) {
        return fail(paid.code as BookingCommandFailure["code"], paid.message);
      }

      try {
        const r = await backend.applyTransition(cmd, booking.id, "payout_ready", "paid_out");
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Mark paid-out failed.");
      }
    }

    case "MARK_COMPLETED": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      if (cmd.actor.actorType === "cleaner") {
        if (!booking.cleaner_id) {
          return fail("ASSIGNMENT_CONFLICT", "No cleaner assigned on this booking.");
        }
        const cln = assertCleanerIs(cmd, booking.cleaner_id, ctx);
        if (cln) return cln;
      }
      if (cmd.recordEarningsSnapshot) {
        if (
          cmd.earningsSnapshotCents == null ||
          cmd.earningsCleanerId == null ||
          cmd.earningsSnapshotCents < 0
        ) {
          return fail(
            "INVALID_PAYLOAD",
            "recordEarningsSnapshot requires earningsSnapshotCents >= 0 and earningsCleanerId.",
          );
        }
      }
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      try {
        const r = await backend.applyTransition(cmd, booking.id, "in_progress", "completed");
        if (cmd.recordEarningsSnapshot) {
          const payout = cmd.earningsSnapshotCents!;
          await backend.appendEarningLine({
            cleaner_id: cmd.earningsCleanerId!,
            booking_id: booking.id,
            amount_cents: payout,
            gross_amount_cents: booking.price_cents,
            payout_amount_cents: payout,
            payout_status: "pending",
            payout_batch_id: null,
            line_type: "booking_completion_snapshot",
            description: "Explicit snapshot from MARK_COMPLETED",
            metadata: { guarded: true },
            calculation_metadata: { source: "MARK_COMPLETED_snapshot" },
          });
        }
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Mark completed failed.");
      }
    }

    case "CANCEL_BOOKING": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const own = assertCustomerOwnsBooking(cmd, booking, ctx);
      if (own) return own;
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      try {
        const r = await backend.applyTransition(
          cmd,
          booking.id,
          booking.status,
          "cancelled",
        );
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Cancel booking failed.");
      }
    }

    case "ADMIN_OVERRIDE_STATUS": {
      if (cmd.actor.actorType !== "admin") {
        return fail("FORBIDDEN", "Admin override requires an admin actor.");
      }
      if (!(BOOKING_STATUSES as readonly string[]).includes(cmd.nextStatus)) {
        return fail("INVALID_PAYLOAD", "Invalid target status for admin override.");
      }
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      try {
        const status = await backend.adminOverrideStatus(cmd, booking);
        return ok(booking.id, status, false);
      } catch {
        return fail("PERSISTENCE_ERROR", "Admin override failed.");
      }
    }

    case "RECORD_ASSIGNMENT_ATTENTION": {
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      try {
        const merged = mergeBookingMetadataAssignment(booking.metadata, cmd.assignment);
        await backend.updateBookingMetadata(booking.id, merged as Json);
        await backend.appendAudit(cmd, booking.id, booking.status, booking.status);
        return ok(booking.id, booking.status, false);
      } catch {
        return fail("PERSISTENCE_ERROR", "Could not record assignment metadata.");
      }
    }

    case "EXPIRE_ASSIGNMENT_OFFER": {
      if (!cmd.idempotencyKey?.trim()) {
        return fail(
          "IDEMPOTENCY_REQUIRED",
          "EXPIRE_ASSIGNMENT_OFFER requires idempotencyKey.",
        );
      }
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      if (
        (await backend.findAuditsByBookingAndKey(cmd.bookingId, cmd.idempotencyKey)).length > 0
      ) {
        return ok(booking.id, booking.status, true);
      }
      const offer = await backend.getOffer(cmd.offerId);
      if (!offer || offer.booking_id !== booking.id) {
        return fail("OFFER_NOT_FOUND", "Offer not found for this booking.");
      }
      if (offer.cleaner_id !== cmd.cleanerId) {
        return fail("INVALID_PAYLOAD", "Cleaner id does not match offer.");
      }
      if (offer.status === "expired") {
        return ok(booking.id, booking.status, true);
      }
      if (offer.status !== "offered") {
        return fail("OFFER_NOT_OPEN", "Offer is not open for expiry.");
      }
      if (!isOfferPastExpiryAt(offer, cmd.expiredAt)) {
        return fail("OFFER_NOT_OPEN", "Offer has not reached expiry time.");
      }
      try {
        const r = await backend.expireAssignmentOffer(cmd, booking.id, cmd.offerId);
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Could not expire assignment offer.");
      }
    }

    case "RECORD_ASSIGNMENT_OFFER_EXPIRED": {
      if (!cmd.idempotencyKey?.trim()) {
        return fail(
          "IDEMPOTENCY_REQUIRED",
          "RECORD_ASSIGNMENT_OFFER_EXPIRED requires idempotencyKey.",
        );
      }
      const booking = await backend.getBooking(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      if (
        (await backend.findAuditsByBookingAndKey(cmd.bookingId, cmd.idempotencyKey)).length > 0
      ) {
        return ok(booking.id, booking.status, true);
      }
      const offer = await backend.getOffer(cmd.offerId);
      if (!offer || offer.booking_id !== booking.id) {
        return fail("OFFER_NOT_FOUND", "Offer not found for this booking.");
      }
      if (offer.status !== "expired") {
        return fail("OFFER_NOT_OPEN", "Offer must be expired before recording expiry audit.");
      }
      if (offer.cleaner_id !== cmd.cleanerId) {
        return fail("INVALID_PAYLOAD", "Cleaner id does not match offer.");
      }
      try {
        const auditCmd: BookingCommand = {
          ...cmd,
          metadata: {
            offerId: cmd.offerId,
            cleanerId: cmd.cleanerId,
            expiredAt: cmd.expiredAt,
            expirySource: "cron",
            previousOfferStatus: "offered",
            ...(cmd.metadata && typeof cmd.metadata === "object" ? cmd.metadata : {}),
          },
        };
        await backend.appendAudit(auditCmd, booking.id, booking.status, booking.status);
        return ok(booking.id, booking.status, false);
      } catch {
        return fail("PERSISTENCE_ERROR", "Could not record offer expiry audit.");
      }
    }

    default: {
      const _never: never = cmd;
      return _never;
    }
  }
}
