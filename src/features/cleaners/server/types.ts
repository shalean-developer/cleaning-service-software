import type { ServiceSlug } from "@/features/pricing/server/types";

export type CleanerEligibilityStatus = "eligible" | "ineligible";

export type CleanerEligibilityCode =
  | "active"
  | "inactive"
  | "suspended"
  | "no_service_capability"
  | "outside_service_area"
  | "outside_availability_window"
  | "time_off"
  | "schedule_conflict";

export type AvailabilityWindow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  timezone: string;
};

export type TimeOffBlock = {
  startAt: string;
  endAt: string;
};

/** Internal record loaded server-side (never returned from APIs). */
export type CleanerCandidateRecord = {
  cleanerId: string;
  displayName: string;
  active: boolean;
  suspendedAt: string | null;
  averageRating: number | null;
  hiredAt: string;
  phone: string | null;
  profileId: string;
  serviceAreas: string[];
  serviceSlugs: string[];
  availabilityWindows: AvailabilityWindow[];
  timeOffBlocks: TimeOffBlock[];
};

export type BookingSlot = {
  scheduledStart: string;
  scheduledEnd: string;
};

export type EligibilityQuery = {
  serviceSlug: ServiceSlug;
  areaSlug: string;
  slot: BookingSlot;
  teamSize?: number;
  excludeBookingId?: string | null;
};

export type EligibilityEvaluation = {
  eligible: boolean;
  code: CleanerEligibilityCode | null;
  message: string;
};

/** Safe fields exposed to customers via APIs. */
export type CleanerPublicCard = {
  cleanerId: string;
  displayName: string;
  rating: number | null;
  serviceAreasSummary: string;
  availabilitySummary: string;
  eligibilityStatus: CleanerEligibilityStatus;
  eligibilityReason: string;
  eligibilityCode: CleanerEligibilityCode | null;
  estimatedEarningsPreviewCents?: number;
};

export type BestAvailableRecommendation = {
  cleanerId: string;
  displayName: string;
  rankScore: number;
  reason: string;
};

export type AvailableCleanersResult = {
  cleaners: CleanerPublicCard[];
  bestAvailable: BestAvailableRecommendation | null;
};

export type SelectedCleanerCheck = {
  cleanerId: string;
  eligible: boolean;
  eligibilityStatus: CleanerEligibilityStatus;
  eligibilityReason: string;
  eligibilityCode: CleanerEligibilityCode | null;
};

export type BookingCleanersResult = AvailableCleanersResult & {
  selectedCleaner: SelectedCleanerCheck | null;
};
