import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { readAssignmentMetadata } from "./assignmentMetadata";
import { isOfferOpenForOps } from "./buildOfferExpiry";
import { ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING } from "./constants";
import { createDispatchOffer } from "./createDispatchOffer";
import {
  pickBestEligibleCleanerIdExcluding,
} from "./eligibilityForAssignment";
import { loadAssignmentContext } from "./assignmentContext";
import { listOffersForBooking } from "./offerRepository";
import { recordAssignmentOutcome } from "./recordAssignmentOutcome";
import type { AssignmentPath } from "./types";
import type { BookingCommandBackend } from "@/features/bookings/server/commands/bookingCommandBackend";
import type { Database } from "@/lib/database/types";

const REDISPATCH_PATHS: ReadonlySet<AssignmentPath | null> = new Set([
  "best_available",
  "fallback_best_available",
  null,
]);

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

/**
 * After one or more offers expired on a booking: set attention or redispatch (best_available only).
 * Selected-cleaner path does not auto-redispatch — admin must act (policy gap documented in constants).
 */
export async function processBookingAfterOfferExpiry(
  client: SupabaseClient<Database>,
  backend: BookingCommandBackend,
  bookingId: string,
  now: Date = new Date(),
): Promise<{ redispatched: boolean; attentionRequired: boolean }> {
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
  const path = meta?.path ?? null;

  if (offers.length >= ASSIGNMENT_MAX_DISPATCH_ATTEMPTS_PER_BOOKING) {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path,
      cleanerId: meta?.cleanerId ?? null,
      offerId: null,
      reason: "Maximum assignment dispatch attempts reached after offer expiry.",
    });
    return { redispatched: false, attentionRequired: true };
  }

  if (path === "selected") {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path,
      cleanerId: meta?.cleanerId ?? null,
      offerId: null,
      reason: "Assignment offer expired; selected cleaner requires admin redispatch.",
    });
    return { redispatched: false, attentionRequired: true };
  }

  if (!REDISPATCH_PATHS.has(path)) {
    await recordAssignmentOutcome(backend, bookingId, {
      status: "attention_required",
      path,
      cleanerId: meta?.cleanerId ?? null,
      offerId: null,
      reason: "Assignment offer expired; booking needs redispatch.",
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
      reason: "Assignment offer expired; missing assignment context for redispatch.",
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
      reason: "Assignment offer expired; no eligible cleaner available for auto-redispatch.",
    });
    return { redispatched: false, attentionRequired: true };
  }

  const dispatch = await createDispatchOffer(backend, {
    bookingId,
    cleanerId: nextCleanerId,
    reason: "Auto-redispatch after prior offer expired",
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
