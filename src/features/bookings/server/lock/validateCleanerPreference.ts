import { evaluateCleanerEligibility } from "@/features/cleaners/server/eligibility/evaluate";
import { parseBookingSlot } from "@/features/cleaners/server/eligibility/slot";
import {
  loadCleanerCandidates,
  loadConflictingCleanerIds,
} from "@/features/cleaners/server/repository";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import type { BookingLockInput } from "./types";
import { BOOKING_LOCK_TIMEZONE } from "./constants";

export async function validateCleanerPreferenceForLock(
  input: BookingLockInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (input.cleanerPreference.mode === "best_available") {
    return { ok: true };
  }

  const cleanerId = input.cleanerPreference.selectedCleanerId;
  if (!cleanerId) {
    return { ok: false, message: "Selected cleaner id is required." };
  }

  const client = requireServiceRoleClient();
  const candidates = await loadCleanerCandidates(client);
  const candidate = candidates.find((c) => c.cleanerId === cleanerId);
  if (!candidate) {
    return { ok: false, message: "Selected cleaner was not found." };
  }

  const slot = parseBookingSlot(
    {
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
    },
    input.scheduleTimezone ?? BOOKING_LOCK_TIMEZONE,
  );
  if (!slot) {
    return { ok: false, message: "Invalid schedule for cleaner check." };
  }

  const conflicts = await loadConflictingCleanerIds(
    client,
    input.scheduledStart,
    input.scheduledEnd,
  );

  const evaluation = evaluateCleanerEligibility(
    candidate,
    {
      serviceSlug: input.pricingInput.serviceSlug,
      areaSlug: input.areaSlug,
      slot: {
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
      },
    },
    slot,
    conflicts,
  );

  if (!evaluation.eligible) {
    return {
      ok: false,
      message: evaluation.message,
    };
  }

  return { ok: true };
}
