import "server-only";

export type FinanceReconciliationIssueSeverity = "info" | "warning" | "error";

export type FinanceReconciliationIssueCode =
  | "MATCHED"
  | "MISSING_ZOHO_SYNC"
  | "ZOHO_SYNC_PENDING"
  | "ZOHO_SYNC_FAILED"
  | "MISSING_ZOHO_PAYMENT_ID"
  | "PAYSTACK_PENDING"
  | "PAYSTACK_FAILED"
  | "AMOUNT_MISMATCH"
  | "CREDIT_NOTE_PENDING"
  | "CREDIT_NOTE_FAILED"
  | "CREDIT_NOTE_MISSING_ID";

export type FinanceReconciliationIssueDefinition = {
  code: FinanceReconciliationIssueCode;
  label: string;
  severity: FinanceReconciliationIssueSeverity;
  actionHint: string;
};

export const FINANCE_RECONCILIATION_ISSUE_CODES: Record<
  FinanceReconciliationIssueCode,
  FinanceReconciliationIssueDefinition
> = {
  MATCHED: {
    code: "MATCHED",
    label: "Matched",
    severity: "info",
    actionHint: "No action required.",
  },
  MISSING_ZOHO_SYNC: {
    code: "MISSING_ZOHO_SYNC",
    label: "Missing Zoho sync",
    severity: "warning",
    actionHint: "Check Zoho sales sync queue at /admin/operations/zoho-sales-sync.",
  },
  ZOHO_SYNC_PENDING: {
    code: "ZOHO_SYNC_PENDING",
    label: "Zoho sync pending",
    severity: "warning",
    actionHint: "Wait for cron retry or inspect /admin/operations/zoho-sales-sync.",
  },
  ZOHO_SYNC_FAILED: {
    code: "ZOHO_SYNC_FAILED",
    label: "Zoho sync failed",
    severity: "error",
    actionHint: "Review failed sync row and retry via Zoho sales sync cron.",
  },
  MISSING_ZOHO_PAYMENT_ID: {
    code: "MISSING_ZOHO_PAYMENT_ID",
    label: "Missing Zoho payment",
    severity: "error",
    actionHint: "Review Zoho invoice payment diagnostics and reconcile cron.",
  },
  PAYSTACK_PENDING: {
    code: "PAYSTACK_PENDING",
    label: "Paystack pending",
    severity: "warning",
    actionHint: "Check Paystack dashboard for payment status.",
  },
  PAYSTACK_FAILED: {
    code: "PAYSTACK_FAILED",
    label: "Paystack failed",
    severity: "error",
    actionHint: "Investigate failed Paystack payment in processor dashboard.",
  },
  AMOUNT_MISMATCH: {
    code: "AMOUNT_MISMATCH",
    label: "Amount mismatch",
    severity: "error",
    actionHint: "Compare Shalean, Paystack, and Zoho amounts manually before adjusting.",
  },
  CREDIT_NOTE_PENDING: {
    code: "CREDIT_NOTE_PENDING",
    label: "Credit note pending",
    severity: "warning",
    actionHint: "Monitor /admin/operations/zoho-refunds for retry progress.",
  },
  CREDIT_NOTE_FAILED: {
    code: "CREDIT_NOTE_FAILED",
    label: "Credit note failed",
    severity: "error",
    actionHint: "Review failed credit sync and Zoho Books connectivity.",
  },
  CREDIT_NOTE_MISSING_ID: {
    code: "CREDIT_NOTE_MISSING_ID",
    label: "Credit note ID missing",
    severity: "error",
    actionHint: "Credit sync marked synced but Zoho credit note id is absent — investigate Zoho.",
  },
};

export function getFinanceReconciliationIssue(
  code: FinanceReconciliationIssueCode | null,
): FinanceReconciliationIssueDefinition | null {
  if (!code) return null;
  return FINANCE_RECONCILIATION_ISSUE_CODES[code] ?? null;
}
