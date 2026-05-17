import type { AdminOperationalOutcome } from "./adminOperationalAuditTypes";

/** Maps console resultStatus strings to durable audit outcomes. */
export function mapAdminOperationalOutcome(
  resultStatus: string,
  options?: { idempotent?: boolean },
): AdminOperationalOutcome {
  if (options?.idempotent) return "idempotent";

  switch (resultStatus) {
    case "recovered":
    case "offered":
    case "replaced":
      return "success";
    case "already_recovered":
    case "already_offered":
    case "already_replaced":
      return "idempotent";
    case "not_eligible":
    case "still_confirmed":
      return "rejected";
    case "error":
      return "failed";
    default:
      return "failed";
  }
}

export function adminRecoveryIdempotencyKey(bookingId: string): string {
  return `admin:recovery:${bookingId}`;
}

export function adminDispatchIdempotencyKey(
  bookingId: string,
  cleanerId: string,
): string {
  return `admin:dispatch:${bookingId}:${cleanerId}`;
}

export function adminReplaceIdempotencyKey(
  bookingId: string,
  cancelledOfferId: string,
  targetCleanerId: string,
): string {
  return `admin:replace:${bookingId}:${cancelledOfferId}:${targetCleanerId}`;
}
