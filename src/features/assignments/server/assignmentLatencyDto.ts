import { medianOfValues, ASSIGNMENT_LATENCY_MIN_SAMPLE } from "./assignmentLatencyMetrics";

export type AssignmentLatencyMetricStatus = "ok" | "insufficient_data";

export type AssignmentLatencyMetricDto = {
  medianMinutes: number | null;
  sampleSize: number;
  status: AssignmentLatencyMetricStatus;
};

export type AssignmentLatency24h = {
  timeToFirstOffer: AssignmentLatencyMetricDto;
  cleanerResponseTime: AssignmentLatencyMetricDto;
  timeToAssigned: AssignmentLatencyMetricDto;
};

export function buildAssignmentLatencyMetricDto(
  durationsMinutes: readonly number[],
): AssignmentLatencyMetricDto {
  const sampleSize = durationsMinutes.length;

  if (sampleSize < ASSIGNMENT_LATENCY_MIN_SAMPLE) {
    return {
      medianMinutes: null,
      sampleSize,
      status: "insufficient_data",
    };
  }

  return {
    medianMinutes: medianOfValues(durationsMinutes),
    sampleSize,
    status: "ok",
  };
}

export function buildAssignmentLatency24h(input: {
  timeToFirstOfferDurations: readonly number[];
  cleanerResponseDurations: readonly number[];
  timeToAssignedDurations: readonly number[];
}): AssignmentLatency24h {
  return {
    timeToFirstOffer: buildAssignmentLatencyMetricDto(input.timeToFirstOfferDurations),
    cleanerResponseTime: buildAssignmentLatencyMetricDto(input.cleanerResponseDurations),
    timeToAssigned: buildAssignmentLatencyMetricDto(input.timeToAssignedDurations),
  };
}

export function formatLatencyMinutes(minutes: number): string {
  if (minutes < 60) {
    const rounded = Math.round(minutes * 10) / 10;
    return `${rounded} min`;
  }
  if (minutes < 24 * 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours} h`;
  }
  const days = Math.round((minutes / (24 * 60)) * 10) / 10;
  return `${days} d`;
}

export function formatLatencyMetricDisplay(metric: AssignmentLatencyMetricDto): string {
  if (metric.status === "insufficient_data" || metric.medianMinutes == null) {
    return "Insufficient data";
  }
  return formatLatencyMinutes(metric.medianMinutes);
}

export function formatApproximateLatencyMetricDisplay(
  approximateMedianMinutes: number | null,
  status: AssignmentLatencyMetricStatus,
): string {
  if (status === "insufficient_data" || approximateMedianMinutes == null) {
    return "Insufficient data";
  }
  return `~${formatLatencyMinutes(approximateMedianMinutes)}`;
}
