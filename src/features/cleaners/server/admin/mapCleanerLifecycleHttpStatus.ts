import type { CleanerLifecycleCommandResult } from "../lifecycle/types";

export function mapCleanerLifecycleHttpStatus(
  result: CleanerLifecycleCommandResult,
): number {
  if (result.ok) return 200;
  switch (result.code) {
    case "INVALID_PAYLOAD":
      return 400;
    case "CLEANER_NOT_FOUND":
      return 404;
    case "CLEANER_ARCHIVED":
    case "CLEANER_MUST_DEACTIVATE_FIRST":
    case "ACTIVE_BOOKINGS_BLOCK":
      return 409;
    default:
      return 500;
  }
}
