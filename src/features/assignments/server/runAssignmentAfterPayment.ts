import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { executeBookingCommand } from "@/features/bookings/server/commands/executeBookingCommand";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { Database } from "@/lib/database/types";
import { loadAssignmentContext } from "./assignmentContext";
import { readAssignmentMetadata } from "./assignmentMetadata";
import { ASSIGNMENT_POST_PAYMENT_IDEMPOTENCY_PREFIX } from "./constants";
import { createDispatchOffer } from "./createDispatchOffer";
import {
  isCleanerEligibleForAssignment,
  pickBestEligibleCleanerId,
} from "./eligibilityForAssignment";
import { listOffersForBooking } from "./offerRepository";
import { recordAssignmentOutcome } from "./recordAssignmentOutcome";
import type { AssignmentPath, RunAssignmentResult } from "./types";

const systemActor = { actorType: "service" as const, profileId: null };

async function ensurePendingAssignment(
  backend: BookingCommandBackend,
  bookingId: string,
): Promise<{ ok: true; status: string; idempotent: boolean } | RunAssignmentResult> {
  const booking = await backend.getBooking(bookingId);
  if (!booking) {
    return { ok: false, code: "BOOKING_NOT_FOUND", message: "Booking not found." };
  }

  if (booking.status === "assigned" || booking.status === "in_progress") {
    return {
      ok: true,
      bookingId,
      bookingStatus: booking.status,
      outcome: "already_assigned",
      offerId: null,
      cleanerId: booking.cleaner_id,
      idempotent: true,
    };
  }

  if (booking.status === "pending_assignment") {
    return { ok: true, status: booking.status, idempotent: true };
  }

  if (booking.status !== "confirmed") {
    return {
      ok: false,
      code: "INVALID_STATE",
      message: `Assignment engine requires confirmed booking (got ${booking.status}).`,
    };
  }

  const move = await executeBookingCommand(
    backend,
    {
      type: "MOVE_TO_PENDING_ASSIGNMENT",
      actor: systemActor,
      bookingId,
      idempotencyKey: `${ASSIGNMENT_POST_PAYMENT_IDEMPOTENCY_PREFIX}${bookingId}`,
      reason: "Post-payment assignment dispatch",
    },
    {},
  );

  if (!move.ok) {
    return {
      ok: false,
      code: move.code,
      message: move.message,
    };
  }

  return { ok: true, status: move.status, idempotent: move.idempotent };
}

async function dispatchOffer(
  backend: BookingCommandBackend,
  bookingId: string,
  cleanerId: string,
  path: AssignmentPath,
): Promise<RunAssignmentResult> {
  const offer = await createDispatchOffer(backend, {
    bookingId,
    cleanerId,
    reason: `Assignment path: ${path}`,
  });

  if (!offer.ok) {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path,
      cleanerId,
      offerId: null,
      reason: offer.message,
    });
    return {
      ok: false,
      code: offer.code,
      message: offer.message,
    };
  }

  await recordAssignmentOutcome(backend, bookingId, {
    status: "offered",
    path,
    cleanerId,
    offerId: offer.offerId ?? null,
    reason: null,
  });

  const booking = await backend.getBooking(bookingId);

  return {
    ok: true,
    bookingId,
    bookingStatus: booking?.status ?? "pending_assignment",
    outcome: "offered",
    offerId: offer.offerId ?? null,
    cleanerId,
    idempotent: offer.idempotent,
  };
}

/**
 * Runs after successful payment finalization. Never rolls back payment.
 */
export async function runAssignmentAfterPayment(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  bookingId: string,
): Promise<RunAssignmentResult> {
  const booking = await backend.getBooking(bookingId);
  if (!booking) {
    return { ok: false, code: "BOOKING_NOT_FOUND", message: "Booking not found." };
  }

  const existingMeta = readAssignmentMetadata(booking.metadata);
  const offers = await listOffersForBooking(client, bookingId);
  const openOffer = offers.find((o) => o.status === "offered");
  const acceptedOffer = offers.find((o) => o.status === "accepted");

  if (booking.status === "assigned" || acceptedOffer) {
    return {
      ok: true,
      bookingId,
      bookingStatus: booking.status,
      outcome: "already_assigned",
      offerId: acceptedOffer?.id ?? null,
      cleanerId: booking.cleaner_id ?? acceptedOffer?.cleaner_id ?? null,
      idempotent: true,
    };
  }

  if (openOffer && booking.status === "pending_assignment") {
    return {
      ok: true,
      bookingId,
      bookingStatus: booking.status,
      outcome: "offered",
      offerId: openOffer.id,
      cleanerId: openOffer.cleaner_id,
      idempotent: true,
    };
  }

  if (
    existingMeta?.status === "attention_required" &&
    booking.status === "pending_assignment" &&
    !openOffer
  ) {
    return {
      ok: true,
      bookingId,
      bookingStatus: booking.status,
      outcome: "attention_required",
      offerId: null,
      cleanerId: null,
      idempotent: true,
    };
  }

  const refreshed = await backend.getBooking(bookingId);
  const context = await loadAssignmentContext(client, refreshed ?? booking);
  if (!context) {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path: null,
      cleanerId: null,
      offerId: null,
      reason: "Missing assignment context (lock/metadata).",
    });
    return {
      ok: false,
      code: "ASSIGNMENT_CONTEXT_MISSING",
      message: "Could not load booking assignment context.",
    };
  }

  const pending = await ensurePendingAssignment(backend, bookingId);
  if (!pending.ok) {
    if ("outcome" in pending) return pending;
    return pending;
  }
  if ("outcome" in pending) return pending;

  const preference = context.cleanerPreference;

  if (preference.mode === "selected" && preference.selectedCleanerId) {
    const selectedId = preference.selectedCleanerId;
    const eligible = await isCleanerEligibleForAssignment(client, context, selectedId);
    if (eligible) {
      return dispatchOffer(backend, bookingId, selectedId, "selected");
    }

    const fallbackId = await pickBestEligibleCleanerId(client, context);
    if (fallbackId && fallbackId !== selectedId) {
      await recordAssignmentOutcome(backend, bookingId, {
        status: "attention_required",
        path: "selected",
        cleanerId: selectedId,
        offerId: null,
        reason: "Selected cleaner ineligible at assignment; falling back to best available.",
      });
      return dispatchOffer(backend, bookingId, fallbackId, "fallback_best_available");
    }

    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path: "selected",
      cleanerId: selectedId,
      offerId: null,
      reason: "Selected cleaner ineligible and no fallback cleaner available.",
    });
    return {
      ok: true,
      bookingId,
      bookingStatus: "pending_assignment",
      outcome: "attention_required",
      offerId: null,
      cleanerId: selectedId,
      idempotent: false,
    };
  }

  const bestId = await pickBestEligibleCleanerId(client, context);
  if (!bestId) {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path: "best_available",
      cleanerId: null,
      offerId: null,
      reason: "No eligible cleaner available for auto-dispatch.",
    });
    return {
      ok: true,
      bookingId,
      bookingStatus: "pending_assignment",
      outcome: "attention_required",
      offerId: null,
      cleanerId: null,
      idempotent: false,
    };
  }

  return dispatchOffer(backend, bookingId, bestId, "best_available");
}
