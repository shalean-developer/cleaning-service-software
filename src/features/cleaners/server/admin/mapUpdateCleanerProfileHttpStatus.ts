import type { UpdateCleanerProfileResult } from "./updateCleanerProfileTypes";

export function mapUpdateCleanerProfileHttpStatus(result: UpdateCleanerProfileResult): number {
  if (result.ok) return 200;
  switch (result.code) {
    case "INVALID_PAYLOAD":
      return 400;
    case "CLEANER_NOT_FOUND":
      return 404;
    default:
      return 500;
  }
}
