import "server-only";

import type { PaymentStatus } from "@/lib/database/types";
import type {
  ZohoInvoiceAuthorizationChargeStatus,
  ZohoInvoicePaymentStatus,
} from "@/lib/database/types";
import type { CustomerPaymentHistoryStatus } from "../customerPaymentHistoryTypes";

export type { CustomerPaymentHistoryStatus } from "../customerPaymentHistoryTypes";
export { labelForCustomerPaymentHistoryStatus } from "../customerPaymentHistoryLabels";

export function mapBookingPaymentStatus(
  status: PaymentStatus,
): CustomerPaymentHistoryStatus {
  switch (status) {
    case "paid":
      return "paid";
    case "pending":
    case "initialized":
      return "pending";
    case "failed":
    case "refunded":
      return "failed";
    default:
      return "failed";
  }
}

export function mapZohoInvoicePaymentStatus(
  status: ZohoInvoicePaymentStatus,
): CustomerPaymentHistoryStatus {
  switch (status) {
    case "paid":
      return "paid";
    case "pending_paystack":
    case "zoho_reconcile_pending":
    case "initialized":
      return "pending";
    case "failed":
    case "zoho_reconcile_failed":
    case "cancelled":
      return "failed";
    default:
      return "failed";
  }
}

export function mapSavedCardInvoiceChargeStatus(
  status: ZohoInvoiceAuthorizationChargeStatus,
): CustomerPaymentHistoryStatus {
  switch (status) {
    case "paid":
      return "paid";
    case "initialized":
    case "submitted":
    case "pending_webhook":
    case "zoho_reconcile_pending":
      return "pending";
    case "failed":
    case "zoho_reconcile_failed":
      return "failed";
    default:
      return "failed";
  }
}
