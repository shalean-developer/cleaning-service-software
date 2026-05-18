import type { OfferMetricsInput } from "./assignmentMetricsAggregate";
import { isTimestampInBucket } from "./assignmentMetricsHourlyUtc";

export const ASSIGNMENT_LATENCY_MIN_SAMPLE = 10;

export type BookingAuditTimestamp = {
  booking_id: string;
  created_at: string;
};

export function durationMinutesBetween(startIso: string, endIso: string): number | null {
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  const deltaMs = endMs - startMs;
  if (deltaMs < 0) return null;
  return deltaMs / 60_000;
}

export function medianOfValues(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (lower == null || upper == null) return null;
  return (lower + upper) / 2;
}

export function collectCleanerResponseDurationsMinutes(
  offers: readonly OfferMetricsInput[],
  bucketStart: Date,
  bucketEnd: Date,
): number[] {
  const durations: number[] = [];

  for (const offer of offers) {
    if (offer.status !== "accepted" && offer.status !== "declined") continue;
    if (!offer.responded_at) continue;
    if (!isTimestampInBucket(offer.responded_at, bucketStart, bucketEnd)) continue;

    const minutes = durationMinutesBetween(offer.offered_at, offer.responded_at);
    if (minutes != null) durations.push(minutes);
  }

  return durations;
}

export function minOfferedAtByBooking(
  offers: readonly OfferMetricsInput[],
): Map<string, string> {
  const minOfferedByBooking = new Map<string, string>();

  for (const offer of offers) {
    const existing = minOfferedByBooking.get(offer.booking_id);
    if (!existing || offer.offered_at < existing) {
      minOfferedByBooking.set(offer.booking_id, offer.offered_at);
    }
  }

  return minOfferedByBooking;
}

export function collectTimeToFirstOfferDurationsMinutes(
  offers: readonly OfferMetricsInput[],
  pendingByBookingId: ReadonlyMap<string, string>,
  bucketStart: Date,
  bucketEnd: Date,
): number[] {
  const durations: number[] = [];

  for (const [bookingId, firstOfferedAt] of minOfferedAtByBooking(offers)) {
    if (!isTimestampInBucket(firstOfferedAt, bucketStart, bucketEnd)) continue;

    const pendingAt = pendingByBookingId.get(bookingId);
    if (!pendingAt) continue;

    const minutes = durationMinutesBetween(pendingAt, firstOfferedAt);
    if (minutes != null) durations.push(minutes);
  }

  return durations;
}

export function minCreatedAtByBooking(
  rows: readonly BookingAuditTimestamp[],
): Map<string, string> {
  const minByBooking = new Map<string, string>();

  for (const row of rows) {
    const existing = minByBooking.get(row.booking_id);
    if (!existing || row.created_at < existing) {
      minByBooking.set(row.booking_id, row.created_at);
    }
  }

  return minByBooking;
}

export function collectTimeToAssignedDurationsMinutes(
  acceptAudits: readonly BookingAuditTimestamp[],
  pendingByBookingId: ReadonlyMap<string, string>,
): number[] {
  const durations: number[] = [];

  for (const [bookingId, assignedAt] of minCreatedAtByBooking(acceptAudits)) {
    const pendingAt = pendingByBookingId.get(bookingId);
    if (!pendingAt) continue;

    const minutes = durationMinutesBetween(pendingAt, assignedAt);
    if (minutes != null) durations.push(minutes);
  }

  return durations;
}
