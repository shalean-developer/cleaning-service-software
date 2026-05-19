import type { CreateCleanerResult } from "./createCleanerTypes";

export function mapCreateCleanerHttpStatus(result: CreateCleanerResult): number {
  if (result.ok) return 201;
  switch (result.code) {
    case "INVALID_PAYLOAD":
      return 400;
    case "PHONE_ALREADY_REGISTERED":
    case "EMAIL_ALREADY_REGISTERED":
      return 409;
    default:
      return 500;
  }
}
