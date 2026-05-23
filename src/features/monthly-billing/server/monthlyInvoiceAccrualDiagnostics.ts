import "server-only";

export type MonthlyInvoiceAccrualDiagnosticReason =
  | "batch_locked"
  | "missing_amount"
  | "feature_disabled"
  | "persistence_error"
  | "completed_not_accrued";

export type MonthlyInvoiceAccrualDiagnosticEntry = {
  bookingId: string;
  customerId: string | null;
  reason: MonthlyInvoiceAccrualDiagnosticReason | string;
  message: string;
  batchId?: string | null;
  recordedAt: string;
};

const recentDiagnostics: MonthlyInvoiceAccrualDiagnosticEntry[] = [];
const MAX_IN_MEMORY_DIAGNOSTICS = 200;

export async function recordMonthlyInvoiceAccrualDiagnostic(input: {
  bookingId: string;
  customerId: string | null;
  reason: MonthlyInvoiceAccrualDiagnosticReason | string;
  message: string;
  batchId?: string | null;
}): Promise<void> {
  const entry: MonthlyInvoiceAccrualDiagnosticEntry = {
    ...input,
    recordedAt: new Date().toISOString(),
  };
  recentDiagnostics.unshift(entry);
  if (recentDiagnostics.length > MAX_IN_MEMORY_DIAGNOSTICS) {
    recentDiagnostics.length = MAX_IN_MEMORY_DIAGNOSTICS;
  }
}

export function getRecentMonthlyInvoiceAccrualDiagnostics(): MonthlyInvoiceAccrualDiagnosticEntry[] {
  return [...recentDiagnostics];
}

export function clearMonthlyInvoiceAccrualDiagnosticsForTests(): void {
  recentDiagnostics.length = 0;
}
