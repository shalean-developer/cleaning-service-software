export const MONTHLY_INVOICE_ACCRUAL_SKIP_REASONS = [
  "not_monthly_account",
  "not_service_authorized",
  "not_completed",
  "missing_customer",
  "missing_amount",
  "feature_disabled",
  "already_accrued",
  "batch_locked",
  "invalid_billing_month",
] as const;

export type MonthlyInvoiceAccrualSkipReason =
  (typeof MONTHLY_INVOICE_ACCRUAL_SKIP_REASONS)[number];

export type AccrueMonthlyInvoiceItemInput = {
  bookingId: string;
  /** When omitted, booking is loaded by id. */
  booking?: import("@/lib/database/types").BookingRow;
};

export type MonthlyInvoiceAccrualSuccess = {
  ok: true;
  outcome: "accrued" | "already_accrued";
  batchId: string;
  itemId: string;
  billingMonth: string;
  amountCents: number;
};

export type MonthlyInvoiceAccrualSkipped = {
  ok: true;
  outcome: "skipped";
  reason: MonthlyInvoiceAccrualSkipReason;
  message: string;
  batchId?: string;
};

export type MonthlyInvoiceAccrualFailure = {
  ok: false;
  code: "PERSISTENCE_ERROR" | "INTEGRITY_ERROR";
  message: string;
};

export type MonthlyInvoiceAccrualResult =
  | MonthlyInvoiceAccrualSuccess
  | MonthlyInvoiceAccrualSkipped
  | MonthlyInvoiceAccrualFailure;
