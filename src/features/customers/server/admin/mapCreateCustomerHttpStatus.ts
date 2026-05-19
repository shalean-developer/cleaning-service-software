import type { CreateCustomerResult } from "./createCustomerTypes";

export function mapCreateCustomerHttpStatus(result: CreateCustomerResult): number {
  if (result.ok) {
    return result.idempotent ? 200 : 201;
  }
  switch (result.code) {
    case "INVALID_PAYLOAD":
    case "INVALID_PHONE":
      return 400;
    case "ROLE_CONFLICT":
    case "EMAIL_ALREADY_REGISTERED":
      return 409;
    default:
      return 500;
  }
}
