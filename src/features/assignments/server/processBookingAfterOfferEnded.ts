import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { readAssignmentMetadata } from "./assignmentMetadata";
import { isOfferOpenForOps } from "./buildOfferExpiry";
import { ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING } from "./constants";
import { createDispatchOffer } from "./createDispatchOffer";
import { pickBestEligibleCleanerIdExcluding } from "./eligibilityForAssignment";
import { loadAssignmentContext } from "./assignmentContext";
import { listOffersForBooking } from "./offerRepository";
import { recordAssignmentOutcome } from "./recordAssignmentOutcome";
import type { AssignmentPath } from "./types";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { BookingRow, Database } from "@/lib/database/types";

export type OfferEndedOutcome = "expired" | "declined";

export type ProcessBookingAfterOfferEndedInput = {
  bookingId: string;
  outcome: OfferEndedOutcome;
  endedOfferId?: string | null;
  endedCleanerId?: string | null;
  now?: Date;
};

export const REDISPATCH_ELIGIBLE_PATHS: ReadonlySet<AssignmentPath | null> = new Set([
  "best_available",
  "fallback_best_available",
  null,
]);

export type ProcessBookingAfterOfferEndedResult = {
  redispatched: boolean;
  attentionRequired: boolean;
};

function cleanersToExcludeFromRedispatch(
  offers: Awaited<ReturnType<typeof listOffersForBooking>>,
): Set<string> {
  const excluded = new Set<string>();
  for (const offer of offers) {
    if (
      offer.status === "expired" ||
      offer.status === "declined" ||
      offer.status === "cancelled"
    ) {
      excluded.add(offer.cleaner_id);
    }
  }
  return excluded;
}

function maxAttemptsReason(outcome: OfferEndedOutcome): string {
  return outcome === "expired"
    ? "Maximum assignment dispatch attempts reached after offer expiry."
    : "Maximum assignment dispatch attempts reached after cleaner declined offer.";
}

function selectedPathReason(outcome: OfferEndedOutcome): string {
  return outcome === "expired"
    ? "Assignment offer expired; selected cleaner requires admin redispatch."
    : "Cleaner declined offer; selected cleaner requires admin redispatch.";
}

function unknownPathReason(outcome: OfferEndedOutcome): string {
  return outcome === "expired"
    ? "Assignment offer expired; booking needs redispatch."
    : "Cleaner declined offer; booking needs redispatch.";
}

function missingContextReason(outcome: OfferEndedOutcome): string {
  return outcome === "expired"
    ? "Assignment offer expired; missing assignment context for redispatch."
    : "Cleaner declined offer; missing assignment context for redispatch.";
}

function noEligibleCleanerReason(outcome: OfferEndedOutcome): string {
  return outcome === "expired"
    ? "Assignment offer expired; no eligible cleaner available for auto-redispatch."
    : "Cleaner declined offer; no eligible cleaner available for auto-redispatch.";
}

function redispatchOfferReason(outcome: OfferEndedOutcome): string {
  return outcome === "expired"
    ? "Auto-redispatch after prior offer expired"
    : "Auto-redispatch after cleaner declined offer";
}

export function isRedispatchEligiblePath(path: AssignmentPath | null): boolean {
  return REDISPATCH_ELIGIBLE_PATHS.has(path);
}

export async function resolveAssignmentPathForBooking(
  client: SupabaseClient<Database>,
  booking: BookingRow,
): Promise<AssignmentPath | null> {
  const meta = readAssignmentMetadata(booking.metadata);
  if (meta?.path) return meta.path;

  const context = await loadAssignmentContext(client, booking);
  if (!context) return null;
  if (context.cleanerPreference.mode === "selected") return "selected";
  return "best_available";
}

/**
 * After an offer ends (expired or declined): redispatch or escalate by assignment path.
 * Selected-cleaner bookings do not auto-redispatch.
 */
export async function processBookingAfterOfferEnded(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  input: ProcessBookingAfterOfferEndedInput,
): Promise<ProcessBookingAfterOfferEndedResult> {
  const now = input.now ?? new Date();
  const { bookingId, outcome } = input;

  const booking = await backend.getBooking(bookingId);
  if (!booking || booking.status !== "pending_assignment" || booking.cleaner_id) {
    return { redispatched: false, attentionRequired: false };
  }

  const offers = await listOffersForBooking(client, bookingId);
  const hasOpenOffer = offers.some((o) => isOfferOpenForOps(o, now));
  if (hasOpenOffer) {
    return { redispatched: false, attentionRequired: false };
  }

  const meta = readAssignmentMetadata(booking.metadata);
  const path = await resolveAssignmentPathForBooking(client, booking);
  const endedCleanerId = input.endedCleanerId ?? meta?.cleanerId ?? null;

  const lastOfferOutcome = outcome === "declined" ? "declined" : "expired";

  if (offers.length >= ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING) {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path,
      cleanerId: endedCleanerId,
      offerId: null,
      reason: maxAttemptsReason(outcome),
      lastOfferOutcome,
    });
    return { redispatched: false, attentionRequired: true };
  }

  if (path === "selected") {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path,
      cleanerId: endedCleanerId,
      offerId: input.endedOfferId ?? null,
      reason: selectedPathReason(outcome),
      lastOfferOutcome,
    });
    return { redispatched: false, attentionRequired: true };
  }

  if (!isRedispatchEligiblePath(path)) {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path,
      cleanerId: endedCleanerId,
      offerId: input.endedOfferId ?? null,
      reason: unknownPathReason(outcome),
    });
    return { redispatched: false, attentionRequired: true };
  }

  const context = await loadAssignmentContext(client, booking);
  if (!context) {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path,
      cleanerId: null,
      offerId: null,
      reason: missingContextReason(outcome),
    });
    return { redispatched: false, attentionRequired: true };
  }

  const exclude = cleanersToExcludeFromRedispatch(offers);
  const nextCleanerId = await pickBestEligibleCleanerIdExcluding(
    client,
    context,
    exclude,
  );

  if (!nextCleanerId) {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path: path ?? "best_available",
      cleanerId: null,
      offerId: null,
      reason: noEligibleCleanerReason(outcome),
    });
    return { redispatched: false, attentionRequired: true };
  }

  const dispatch = await createDispatchOffer(backend, {
    bookingId,
    cleanerId: nextCleanerId,
    reason: redispatchOfferReason(outcome),
  });

  if (!dispatch.ok) {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path: path ?? "best_available",
      cleanerId: nextCleanerId,
      offerId: null,
      reason: dispatch.message,
    });
    return { redispatched: false, attentionRequired: true };
  }

  await recordAssignmentOutcome(backend, bookingId, {
    status: "offered",
    path: path ?? "best_available",
    cleanerId: nextCleanerId,
    offerId: dispatch.offerId ?? null,
    reason: null,
  });

  return { redispatched: true, attentionRequired: false };
}
