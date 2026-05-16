import type { CleanerPreferenceLock } from "@/features/bookings/server/lock/types";
import type { PricingInput } from "@/features/pricing/server/types";

export const ASSIGNMENT_ENGINE_VERSION = "2026-05-16-phase8";

export type AssignmentPath =
  | "selected"
  | "best_available"
  | "fallback_best_available";

export type AssignmentOutcomeStatus =
  | "offered"
  | "attention_required"
  | "already_assigned"
  | "skipped";

export type AssignmentMetadata = {
  engineVersion: typeof ASSIGNMENT_ENGINE_VERSION;
  status: AssignmentOutcomeStatus;
  path: AssignmentPath | null;
  cleanerId: string | null;
  offerId: string | null;
  reason: string | null;
  attemptedAt: string;
};

export type AssignmentContext = {
  bookingId: string;
  scheduledStart: string;
  scheduledEnd: string;
  scheduleTimezone: string;
  areaSlug: string;
  serviceSlug: string;
  pricingInput: PricingInput;
  cleanerPreference: CleanerPreferenceLock;
  preferredCleanerId: string | null;
};

export type RunAssignmentResult =
  | {
      ok: true;
      bookingId: string;
      bookingStatus: string;
      outcome: AssignmentOutcomeStatus;
      offerId: string | null;
      cleanerId: string | null;
      idempotent: boolean;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };
