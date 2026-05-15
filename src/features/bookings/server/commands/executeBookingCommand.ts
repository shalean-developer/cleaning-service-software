import type { AssignmentOfferRow, BookingRow, PaymentRow } from "@/lib/database/types";
import type { BookingId, BookingStatus } from "../types";
import { BOOKING_STATUSES } from "../types";
import {
  assertActorAuthorizedForCommand,
  assertTransitionShape,
} from "./bookingCommandGuards";
import { InMemoryBookingCommandBackend } from "./inMemoryBookingCommandBackend";
import type {
  BookingCommand,
  BookingCommandFailure,
  BookingCommandResult,
} from "./types";

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

function isPaidForBooking(
  backend: InMemoryBookingCommandBackend,
  bookingId: string,
): boolean {
  for (const p of backend.payments.values()) {
    if (p.booking_id === bookingId && p.status === "paid") return true;
  }
  return false;
}

function getPayment(
  backend: InMemoryBookingCommandBackend,
  paymentId: string,
): PaymentRow | undefined {
  return backend.payments.get(paymentId);
}

function getOffer(
  backend: InMemoryBookingCommandBackend,
  offerId: string,
): AssignmentOfferRow | undefined {
  return backend.offers.get(offerId);
}

function assertCustomerOwnsBooking(
  cmd: BookingCommand,
  booking: BookingRow,
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
 * Central booking command executor (in-memory reference implementation).
 * Server deployments should use the same guard ordering with a Supabase-backed
 * runtime that calls `booking_*` RPCs for atomic transitions.
 */
export async function executeBookingCommand(
  backend: InMemoryBookingCommandBackend,
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
      const row: BookingRow = {
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
        metadata: {},
        created_at: ts,
        updated_at: ts,
      };
      backend.bookings.set(bid, row);
      backend.appendAudit(cmd, bid, null, "draft");
      backend.enqueueNotification("email", cmd.customerId, {
        template: "booking_draft_created",
        bookingId: bid,
      });
      return ok(bid, "draft", false);
    }

    case "MARK_PAYMENT_PENDING": {
      const booking = backend.bookings.get(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const own = assertCustomerOwnsBooking(cmd, booking, ctx);
      if (own) return own;

      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;

      for (const p of backend.payments.values()) {
        if (p.idempotency_key === cmd.paymentIdempotencyKey) {
          if (p.booking_id !== cmd.bookingId) {
            return fail(
              "INVALID_PAYLOAD",
              "paymentIdempotencyKey already belongs to another booking.",
            );
          }
          if (booking.status === "pending_payment") {
            return ok(booking.id, "pending_payment", true);
          }
        }
      }

      const payment: PaymentRow = {
        id: crypto.randomUUID(),
        booking_id: booking.id,
        status: "pending",
        provider: cmd.provider ?? "paystack",
        provider_ref: null,
        idempotency_key: cmd.paymentIdempotencyKey,
        amount_cents: booking.price_cents,
        currency: booking.currency,
        metadata: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      backend.payments.set(payment.id, payment);
      try {
        const r = backend.applyTransition(
          cmd,
          booking.id,
          booking.status,
          "pending_payment",
        );
        backend.enqueueNotification("email", booking.customer_id, {
          template: "payment_pending",
          bookingId: booking.id,
        });
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Could not move booking to pending_payment.");
      }
    }

    case "FINALIZE_PAYMENT_SUCCESS": {
      if (!cmd.idempotencyKey?.trim()) {
        return fail("IDEMPOTENCY_REQUIRED", "FINALIZE_PAYMENT_SUCCESS requires idempotencyKey.");
      }
      const booking = backend.bookings.get(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      if (backend.findAuditsByBookingAndKey(cmd.bookingId, cmd.idempotencyKey).length > 0) {
        return ok(booking.id, booking.status, true);
      }
      const payment = getPayment(backend, cmd.paymentId);
      if (!payment || payment.booking_id !== booking.id) {
        return fail("PAYMENT_NOT_FOUND", "Payment not found for this booking.");
      }
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;

      try {
        const r = backend.finalizePaymentSuccess(cmd, booking.id, payment.id);
        if (!r.idempotent) {
          backend.enqueueNotification("email", booking.customer_id, {
            template: "payment_confirmed",
            bookingId: booking.id,
          });
        }
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Payment finalization failed.");
      }
    }

    case "MARK_PAYMENT_FAILED": {
      const booking = backend.bookings.get(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const payment = getPayment(backend, cmd.paymentId);
      if (!payment || payment.booking_id !== booking.id) {
        return fail("PAYMENT_NOT_FOUND", "Payment not found for this booking.");
      }
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;

      try {
        const r = backend.recordPaymentFailure(cmd, booking.id, payment.id);
        backend.enqueueNotification("email", booking.customer_id, {
          template: "payment_failed",
          bookingId: booking.id,
        });
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Recording payment failure failed.");
      }
    }

    case "MOVE_TO_PENDING_ASSIGNMENT": {
      const booking = backend.bookings.get(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      if (!isPaidForBooking(backend, booking.id)) {
        return fail(
          "PAYMENT_NOT_PAID",
          "Cannot enter pending_assignment until at least one payment is paid for this booking.",
        );
      }
      try {
        const r = backend.applyTransition(
          cmd,
          booking.id,
          "confirmed",
          "pending_assignment",
        );
        backend.enqueueNotification("email", booking.customer_id, {
          template: "pending_assignment",
          bookingId: booking.id,
        });
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Move to pending_assignment failed.");
      }
    }

    case "OFFER_TO_CLEANER": {
      const booking = backend.bookings.get(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      const ts = new Date().toISOString();
      const oid = crypto.randomUUID();
      const offer: AssignmentOfferRow = {
        id: oid,
        booking_id: booking.id,
        cleaner_id: cmd.cleanerId,
        status: "offered",
        offered_at: ts,
        responded_at: null,
        expires_at: cmd.expiresAt ?? null,
        created_at: ts,
        updated_at: ts,
      };
      backend.offers.set(oid, offer);
      backend.enqueueNotification("push", cmd.cleanerId, {
        template: "assignment_offer",
        bookingId: booking.id,
        offerId: oid,
      });
      return ok(booking.id, booking.status, false);
    }

    case "DECLINE_CLEANER_ASSIGNMENT": {
      const booking = backend.bookings.get(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      const offer = getOffer(backend, cmd.offerId);
      if (!offer || offer.booking_id !== booking.id) {
        return fail("OFFER_NOT_FOUND", "Offer not found for this booking.");
      }
      const cln = assertCleanerIs(cmd, offer.cleaner_id, ctx);
      if (cln) return cln;
      if (offer.status !== "offered") {
        return fail("OFFER_NOT_OPEN", "Offer is not in offered state.");
      }
      offer.status = "declined";
      offer.responded_at = new Date().toISOString();
      offer.updated_at = offer.responded_at;
      backend.offers.set(offer.id, offer);
      return ok(booking.id, booking.status, false);
    }

    case "ACCEPT_CLEANER_ASSIGNMENT": {
      const booking = backend.bookings.get(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      if (booking.status !== "pending_assignment") {
        return fail(
          "ASSIGNMENT_CONFLICT",
          "Booking is not awaiting assignment acceptance.",
        );
      }
      const offer = getOffer(backend, cmd.offerId);
      if (!offer || offer.booking_id !== booking.id) {
        return fail("OFFER_NOT_FOUND", "Offer not found for this booking.");
      }
      const cln = assertCleanerIs(cmd, offer.cleaner_id, ctx);
      if (cln) return cln;
      if (offer.status !== "offered") {
        return fail("OFFER_NOT_OPEN", "Offer is not open for acceptance.");
      }
      if (booking.cleaner_id && booking.cleaner_id !== offer.cleaner_id) {
        return fail("ASSIGNMENT_CONFLICT", "Booking already assigned to a different cleaner.");
      }
      try {
        const r = backend.applyTransition(
          cmd,
          booking.id,
          "pending_assignment",
          "assigned",
          offer.cleaner_id,
        );
        offer.status = "accepted";
        offer.responded_at = new Date().toISOString();
        offer.updated_at = offer.responded_at;
        backend.offers.set(offer.id, offer);
        backend.enqueueNotification("email", booking.customer_id, {
          template: "cleaner_assigned",
          bookingId: booking.id,
        });
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Accept assignment failed.");
      }
    }

    case "MARK_IN_PROGRESS": {
      const booking = backend.bookings.get(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
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
        const r = backend.applyTransition(cmd, booking.id, "assigned", "in_progress");
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Mark in progress failed.");
      }
    }

    case "MARK_COMPLETED": {
      const booking = backend.bookings.get(cmd.bookingId);
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
        const r = backend.applyTransition(cmd, booking.id, "in_progress", "completed");
        if (cmd.recordEarningsSnapshot) {
          backend.appendEarningLine({
            cleaner_id: cmd.earningsCleanerId!,
            booking_id: booking.id,
            amount_cents: cmd.earningsSnapshotCents!,
            line_type: "booking_completion_snapshot",
            description: "Explicit snapshot from MARK_COMPLETED",
            metadata: { guarded: true },
          });
        }
        return ok(booking.id, r.status, r.idempotent);
      } catch {
        return fail("PERSISTENCE_ERROR", "Mark completed failed.");
      }
    }

    case "CANCEL_BOOKING": {
      const booking = backend.bookings.get(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const own = assertCustomerOwnsBooking(cmd, booking, ctx);
      if (own) return own;
      const shape = assertTransitionShape(cmd, booking.status);
      if (shape) return shape;
      try {
        const r = backend.applyTransition(cmd, booking.id, booking.status, "cancelled");
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
      const booking = backend.bookings.get(cmd.bookingId);
      if (!booking) return fail("BOOKING_NOT_FOUND", "Booking not found.");
      const from = booking.status;
      booking.status = cmd.nextStatus;
      booking.updated_at = new Date().toISOString();
      backend.bookings.set(booking.id, booking);
      backend.appendAudit(cmd, booking.id, from, cmd.nextStatus);
      return ok(booking.id, cmd.nextStatus, false);
    }

    default: {
      const _never: never = cmd;
      return _never;
    }
  }
}
