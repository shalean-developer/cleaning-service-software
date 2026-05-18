import type { OfferMetricsInput } from "./assignmentMetricsAggregate";
import { buildAssignmentLatency24h, type AssignmentLatency24h } from "./assignmentLatencyDto";
import {
  collectCleanerResponseDurationsMinutes,
  collectTimeToAssignedDurationsMinutes,
  collectTimeToFirstOfferDurationsMinutes,
  type BookingAuditTimestamp,
} from "./assignmentLatencyMetrics";

export function computeAssignmentLatency24h(params: {
  terminalOffers: readonly OfferMetricsInput[];
  allOffersForFirstOffer: readonly OfferMetricsInput[];
  acceptAudits: readonly BookingAuditTimestamp[];
  pendingByBookingId: ReadonlyMap<string, string>;
  bucketStart: Date;
  bucketEnd: Date;
}): AssignmentLatency24h {
  const cleanerResponseDurations = collectCleanerResponseDurationsMinutes(
    params.terminalOffers,
    params.bucketStart,
    params.bucketEnd,
  );
  const timeToFirstOfferDurations = collectTimeToFirstOfferDurationsMinutes(
    params.allOffersForFirstOffer,
    params.pendingByBookingId,
    params.bucketStart,
    params.bucketEnd,
  );
  const timeToAssignedDurations = collectTimeToAssignedDurationsMinutes(
    params.acceptAudits,
    params.pendingByBookingId,
  );

  return buildAssignmentLatency24h({
    timeToFirstOfferDurations,
    cleanerResponseDurations,
    timeToAssignedDurations,
  });
}
