import type {
  BillingMode,
  CustomerBillingAccountAuditAction,
  MonthlyAccountFinanceReviewStatus,
  MonthlyAccountGovernanceState,
  MonthlyInvoiceBatchItemStatus,
  MonthlyInvoiceBatchStatus,
} from "@/lib/database/types";

export type { BillingMode, MonthlyInvoiceBatchStatus, MonthlyInvoiceBatchItemStatus };

export type CustomerBillingAccount = {
  id: string;
  customerId: string;
  billingMode: BillingMode;
  zohoCustomerId: string | null;
  billingEmail: string;
  billingTerms: string;
  isMonthlyAccountEnabled: boolean;
  approvedByAdminId: string | null;
  approvedAt: string | null;
  approvalReason: string | null;
  disabledAt: string | null;
  disabledByAdminId: string | null;
  governanceState: MonthlyAccountGovernanceState;
  creditLimitCents: number | null;
  manualOverrideUntil: string | null;
  suspendedAt: string | null;
  suspendedByAdminId: string | null;
  suspensionReason: string | null;
  lastFinanceReviewAt: string | null;
  lastFinanceReviewBy: string | null;
  financeReviewStatus: MonthlyAccountFinanceReviewStatus | null;
  financeReviewOwnerAdminId: string | null;
  financeReviewFollowUpDate: string | null;
  financeReviewResolution: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CustomerBillingAccountAuditEntry = {
  id: string;
  accountId: string | null;
  customerId: string | null;
  adminProfileId: string | null;
  action: CustomerBillingAccountAuditAction;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type MonthlyInvoiceBatch = {
  id: string;
  customerId: string;
  billingMonth: string;
  status: MonthlyInvoiceBatchStatus;
  zohoInvoiceId: string | null;
  zohoInvoiceNumber: string | null;
  totalCents: number;
  currency: string;
  generatedByAdminId: string | null;
  generatedAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  idempotencyKey: string | null;
  zohoReferenceNumber: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type MonthlyInvoiceBatchItem = {
  id: string;
  batchId: string;
  bookingId: string;
  visitDate: string;
  serviceSlug: string;
  amountCents: number;
  status: MonthlyInvoiceBatchItemStatus;
  zohoLineItemId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
