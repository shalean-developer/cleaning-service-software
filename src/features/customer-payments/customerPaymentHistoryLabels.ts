import type { CustomerPaymentHistoryStatus } from "./customerPaymentHistoryTypes";

export function labelForCustomerPaymentHistoryStatus(
  status: CustomerPaymentHistoryStatus,
): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
  }
}
