import "server-only";

import {
  BILLING_MODES,
  MONTHLY_INVOICE_BATCH_STATUSES,
  type BillingMode,
  type MonthlyInvoiceBatchStatus,
} from "@/lib/database/types";
import { isUuid } from "@/lib/validation/uuid";

export const MONTHLY_BILLING_DEFAULT_LIMIT = 100;
export const MONTHLY_BILLING_MAX_LIMIT = 500;

export class MonthlyBillingValidationError extends Error {
  readonly code = "VALIDATION_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "MonthlyBillingValidationError";
  }
}

export type ParsedMonthlyBillingAccountsQuery = {
  status?: "enabled" | "disabled" | "all";
  mode?: BillingMode;
  limit: number;
};

export type ParsedMonthlyBillingBatchesQuery = {
  customerId?: string;
  status?: MonthlyInvoiceBatchStatus;
  billingMonth?: string;
  limit: number;
};

function parseLimit(raw: string | null): number {
  if (!raw?.trim()) return MONTHLY_BILLING_DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new MonthlyBillingValidationError("limit must be a positive integer.");
  }
  return Math.min(parsed, MONTHLY_BILLING_MAX_LIMIT);
}

function parseBillingMonth(raw: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) {
    throw new MonthlyBillingValidationError("billingMonth must be YYYY-MM-DD.");
  }
  return raw.trim();
}

export function parseMonthlyBillingAccountsQuery(
  searchParams: URLSearchParams,
): ParsedMonthlyBillingAccountsQuery {
  const statusRaw = searchParams.get("status")?.trim();
  let status: ParsedMonthlyBillingAccountsQuery["status"];
  if (statusRaw) {
    if (statusRaw !== "enabled" && statusRaw !== "disabled" && statusRaw !== "all") {
      throw new MonthlyBillingValidationError("status must be enabled, disabled, or all.");
    }
    status = statusRaw;
  }

  const modeRaw = searchParams.get("mode")?.trim();
  let mode: BillingMode | undefined;
  if (modeRaw) {
    if (!(BILLING_MODES as readonly string[]).includes(modeRaw)) {
      throw new MonthlyBillingValidationError(`mode must be one of: ${BILLING_MODES.join(", ")}.`);
    }
    mode = modeRaw as BillingMode;
  }

  return {
    status,
    mode,
    limit: parseLimit(searchParams.get("limit")),
  };
}

export function parseMonthlyBillingBatchesQuery(
  searchParams: URLSearchParams,
): ParsedMonthlyBillingBatchesQuery {
  const customerIdRaw = searchParams.get("customerId")?.trim();
  if (customerIdRaw && !isUuid(customerIdRaw)) {
    throw new MonthlyBillingValidationError("customerId must be a valid UUID.");
  }

  const statusRaw = searchParams.get("status")?.trim();
  let status: MonthlyInvoiceBatchStatus | undefined;
  if (statusRaw) {
    if (!(MONTHLY_INVOICE_BATCH_STATUSES as readonly string[]).includes(statusRaw)) {
      throw new MonthlyBillingValidationError(
        `status must be one of: ${MONTHLY_INVOICE_BATCH_STATUSES.join(", ")}.`,
      );
    }
    status = statusRaw as MonthlyInvoiceBatchStatus;
  }

  return {
    customerId: customerIdRaw || undefined,
    status,
    billingMonth: parseBillingMonth(searchParams.get("billingMonth")),
    limit: parseLimit(searchParams.get("limit")),
  };
}

export function assertCustomerIdParam(customerId: string): void {
  if (!isUuid(customerId)) {
    throw new MonthlyBillingValidationError("customerId must be a valid UUID.");
  }
}

export function assertBatchIdParam(batchId: string): void {
  if (!isUuid(batchId)) {
    throw new MonthlyBillingValidationError("batchId must be a valid UUID.");
  }
}
