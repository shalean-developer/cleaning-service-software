import {
  resolveCleanerOperationalState,
  type CleanerLifecycleSnapshot,
} from "@/features/cleaners/server/lifecycle/operationalState";
import type { BookingCommandFailure } from "./types";

const DEFAULT_MESSAGE =
  "Cleaner is not operational and cannot receive or accept assignment offers.";

export function cleanerOfferOperationalGuardFailure(
  message: string = DEFAULT_MESSAGE,
): BookingCommandFailure {
  return {
    ok: false,
    code: "CLEANER_NOT_OPERATIONAL",
    message,
  };
}

/**
 * Returns a command failure when the cleaner cannot receive or accept offers.
 * Only `active` operational state passes; onboarding, inactive, suspended, and archived fail.
 */
export function assertCleanerOperationalForOffer(
  snapshot: CleanerLifecycleSnapshot | null,
  now: Date = new Date(),
): BookingCommandFailure | null {
  if (!snapshot) {
    return cleanerOfferOperationalGuardFailure();
  }
  if (resolveCleanerOperationalState(snapshot, now) === "active") {
    return null;
  }
  return cleanerOfferOperationalGuardFailure();
}
