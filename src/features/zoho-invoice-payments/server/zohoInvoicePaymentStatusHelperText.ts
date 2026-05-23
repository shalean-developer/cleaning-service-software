import type { ZohoInvoicePaymentStatus } from "@/lib/database/types";
import type { ZohoInvoicePaymentPublicStatus } from "./types";

const PAYMENT_ROW_STATUS_HELPERS: Record<
  Extract<
    ZohoInvoicePaymentStatus,
    | "pending_paystack"
    | "paid"
    | "failed"
    | "zoho_reconcile_pending"
    | "zoho_reconcile_failed"
  >,
  string
> = {
  pending_paystack: "Customer started checkout but payment is not confirmed yet.",
  paid: "Payment confirmed and Zoho reconciliation completed.",
  failed: "Paystack payment failed.",
  zoho_reconcile_pending:
    "Paystack payment succeeded; Zoho reconciliation is retrying.",
  zoho_reconcile_failed:
    "Paystack payment succeeded but Zoho reconciliation needs admin review.",
};

export function paymentRowStatusHelperText(status: ZohoInvoicePaymentStatus): string | null {
  if (status in PAYMENT_ROW_STATUS_HELPERS) {
    return PAYMENT_ROW_STATUS_HELPERS[
      status as keyof typeof PAYMENT_ROW_STATUS_HELPERS
    ];
  }
  return null;
}

export function zohoInvoicePublicStatusLabel(status: ZohoInvoicePaymentPublicStatus): string {
  switch (status) {
    case "payable":
      return "Payable";
    case "paid":
      return "Paid";
    case "void":
      return "Void";
    case "not_found":
      return "Not found";
    case "not_configured":
      return "Not configured";
    case "error":
      return "Unavailable";
  }
}
