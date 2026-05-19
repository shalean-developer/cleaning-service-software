import type { UpdateCustomerResult } from "./updateCustomerTypes";

export function mapUpdateCustomerHttpStatus(result: UpdateCustomerResult): number {
  if (result.ok) return 200;
  switch (result.code) {
    case "INVALID_PAYLOAD":
    case "INVALID_PHONE":
      return 400;
    case "CUSTOMER_NOT_FOUND":
      return 404;
    case "ROLE_CONFLICT":
    case "DUAL_DOMAIN":
    case "DOMAIN_UNHEALTHY":
      return 409;
    default:
      return 500;
  }
}
