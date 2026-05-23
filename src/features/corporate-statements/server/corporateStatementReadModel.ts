import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCustomerEmailForMatch } from "@/features/zoho-invoice-payments/server/zohoInvoiceCustomerEmailMatch";
import type {
  Database,
  PaymentRow,
  ZohoInvoiceAuthorizationChargeRow,
  ZohoInvoicePaymentRow,
  ZohoRefundCreditSyncRow,
  ZohoSalesSyncRow,
} from "@/lib/database/types";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import { logCorporateStatementEvent } from "./corporateStatementLogger";
import type { CorporateStatementPeriodType } from "./parseCorporateStatementQueryParams";
import {
  mapBookingPaymentToStatement,
  mapRefundCreditToStatement,
  mapSavedCardChargeToStatement,
  mapZohoInvoicePaymentToStatement,
  type CorporateStatementLineStatus,
  type CorporateStatementLineType,
} from "./corporateStatementStatus";

export type CorporateStatementFilters = {
  customerEmail?: string;
  customerName?: string;
  zohoCustomerId?: string;
  periodType: CorporateStatementPeriodType;
  from: string;
  to: string;
  limit?: number;
};

export type CorporateStatementSummary = {
  customerLabel: string;
  customerEmail: string | null;
  periodStart: string;
  periodEnd: string;
  openingBalanceCents: number;
  invoiceChargesCents: number;
  paymentsCents: number;
  refundsCreditsCents: number;
  closingBalanceCents: number;
  outstandingCount: number;
  paidCount: number;
};

export type CorporateStatementLineItem = {
  id: string;
  date: string;
  type: CorporateStatementLineType;
  reference: string;
  invoiceNumber: string | null;
  description: string;
  debitCents: number;
  creditCents: number;
  balanceCents: number;
  status: CorporateStatementLineStatus;
};

export type CorporateStatementResult = {
  summary: CorporateStatementSummary;
  items: CorporateStatementLineItem[];
  openingBalanceNote: string;
};

type RawStatementLine = Omit<CorporateStatementLineItem, "balanceCents">;

type CustomerScope = {
  customerLabel: string;
  customerEmail: string | null;
  normalizedEmails: Set<string>;
  zohoCustomerIds: Set<string>;
  bookingIds: Set<string>;
  nameNeedle: string | null;
};

const FETCH_CAP = 500;

function effectiveDate(isoPaidAt: string | null, isoCreatedAt: string): string {
  return isoPaidAt ?? isoCreatedAt;
}

function inPeriod(dateIso: string, from: string, to: string): boolean {
  const ts = new Date(dateIso).getTime();
  const fromTs = new Date(from).getTime();
  const toTs = new Date(to).getTime();
  if (Number.isFinite(fromTs) && ts < fromTs) return false;
  if (Number.isFinite(toTs) && ts > toTs) return false;
  return true;
}

function beforePeriod(dateIso: string, periodStart: string): boolean {
  const ts = new Date(dateIso).getTime();
  const fromTs = new Date(periodStart).getTime();
  return Number.isFinite(fromTs) && ts < fromTs;
}

function nameMatches(candidate: string | null | undefined, needle: string | null): boolean {
  if (!needle) return true;
  if (!candidate?.trim()) return false;
  return candidate.trim().toLowerCase().includes(needle.trim().toLowerCase());
}

function emailMatches(email: string | null | undefined, scope: CustomerScope): boolean {
  if (!email?.trim()) return false;
  if (scope.normalizedEmails.size === 0) return true;
  return scope.normalizedEmails.has(normalizeCustomerEmailForMatch(email));
}

function buildCustomerScope(filters: CorporateStatementFilters): CustomerScope {
  const normalizedEmails = new Set<string>();
  if (filters.customerEmail?.trim()) {
    normalizedEmails.add(normalizeCustomerEmailForMatch(filters.customerEmail));
  }

  const zohoCustomerIds = new Set<string>();
  if (filters.zohoCustomerId?.trim()) {
    zohoCustomerIds.add(filters.zohoCustomerId.trim());
  }

  const label =
    filters.customerName?.trim() ||
    filters.customerEmail?.trim() ||
    (filters.zohoCustomerId ? `Zoho customer ${filters.zohoCustomerId}` : "Corporate client");

  return {
    customerLabel: label,
    customerEmail: filters.customerEmail?.trim().toLowerCase() ?? null,
    normalizedEmails,
    zohoCustomerIds,
    bookingIds: new Set<string>(),
    nameNeedle: filters.customerName?.trim() ?? null,
  };
}

function expandScopeFromRecords(
  scope: CustomerScope,
  invoiceRows: ZohoInvoicePaymentRow[],
  syncRows: ZohoSalesSyncRow[],
): CustomerScope {
  const normalizedEmails = new Set(scope.normalizedEmails);
  const zohoCustomerIds = new Set(scope.zohoCustomerIds);
  const bookingIds = new Set(scope.bookingIds);

  for (const row of invoiceRows) {
    if (emailMatches(row.customer_email, scope) && nameMatches(row.customer_name, scope.nameNeedle)) {
      normalizedEmails.add(normalizeCustomerEmailForMatch(row.customer_email));
    }
  }

  for (const row of syncRows) {
    if (row.zoho_customer_id && zohoCustomerIds.has(row.zoho_customer_id)) {
      if (row.booking_id) bookingIds.add(row.booking_id);
    }
    if (row.booking_id && bookingIds.has(row.booking_id)) {
      if (row.zoho_customer_id) zohoCustomerIds.add(row.zoho_customer_id);
    }
  }

  let customerLabel = scope.customerLabel;
  const namedInvoice = invoiceRows.find(
    (row) =>
      emailMatches(row.customer_email, { ...scope, normalizedEmails }) &&
      nameMatches(row.customer_name, scope.nameNeedle) &&
      row.customer_name?.trim(),
  );
  if (namedInvoice?.customer_name?.trim()) {
    customerLabel = namedInvoice.customer_name.trim();
  }

  const resolvedEmail =
    scope.customerEmail ??
    (normalizedEmails.size === 1 ? [...normalizedEmails][0]! : null);

  return {
    ...scope,
    customerLabel,
    customerEmail: resolvedEmail,
    normalizedEmails,
    zohoCustomerIds,
    bookingIds,
  };
}

function rowMatchesScope(
  scope: CustomerScope,
  input: {
    customerEmail?: string | null;
    customerName?: string | null;
    zohoCustomerId?: string | null;
    bookingId?: string | null;
  },
): boolean {
  if (input.zohoCustomerId && scope.zohoCustomerIds.has(input.zohoCustomerId)) return true;
  if (input.bookingId && scope.bookingIds.has(input.bookingId)) return true;
  if (input.customerEmail && emailMatches(input.customerEmail, scope)) {
    return nameMatches(input.customerName ?? null, scope.nameNeedle);
  }
  if (scope.normalizedEmails.size === 0 && scope.zohoCustomerIds.size === 0 && scope.nameNeedle) {
    return nameMatches(input.customerName ?? null, scope.nameNeedle);
  }
  return false;
}

function mapZohoInvoiceRow(row: ZohoInvoicePaymentRow): RawStatementLine {
  const mapped = mapZohoInvoicePaymentToStatement({
    invoiceNumber: row.invoice_number,
    amountCents: row.amount_cents,
    status: row.status,
    customerName: row.customer_name,
  });

  return {
    id: `zoho_invoice:${row.id}`,
    date: effectiveDate(row.paid_at, row.created_at),
    type: mapped.type,
    reference: row.paystack_reference?.trim() || row.invoice_number,
    invoiceNumber: row.invoice_number,
    description: mapped.description,
    debitCents: mapped.debitCents,
    creditCents: mapped.creditCents,
    status: mapped.status,
  };
}

function mapAuthChargeRow(row: ZohoInvoiceAuthorizationChargeRow): RawStatementLine {
  const mapped = mapSavedCardChargeToStatement({
    invoiceNumber: row.invoice_number,
    amountCents: row.amount_cents,
    status: row.status,
  });

  return {
    id: `saved_card:${row.id}`,
    date: effectiveDate(row.paid_at, row.created_at),
    type: mapped.type,
    reference: row.paystack_reference?.trim() || row.invoice_number,
    invoiceNumber: row.invoice_number,
    description: mapped.description,
    debitCents: mapped.debitCents,
    creditCents: mapped.creditCents,
    status: mapped.status,
  };
}

function mapBookingPaymentRow(
  payment: PaymentRow,
  invoiceNumber: string | null,
): RawStatementLine {
  const mapped = mapBookingPaymentToStatement({
    bookingId: payment.booking_id,
    amountCents: payment.amount_cents,
    status: payment.status,
    invoiceNumber,
  });

  return {
    id: `booking:${payment.id}`,
    date: effectiveDate(payment.status === "paid" ? payment.updated_at : null, payment.created_at),
    type: mapped.type,
    reference: payment.provider_ref?.trim() || payment.id,
    invoiceNumber,
    description: mapped.description,
    debitCents: mapped.debitCents,
    creditCents: mapped.creditCents,
    status: mapped.status,
  };
}

function mapRefundRow(row: ZohoRefundCreditSyncRow): RawStatementLine {
  const mapped = mapRefundCreditToStatement({
    invoiceNumber: row.invoice_number,
    bookingId: row.booking_id,
    amountCents: row.amount_cents,
    syncStatus: row.sync_status,
  });

  return {
    id: `refund_credit:${row.id}`,
    date: effectiveDate(row.synced_at, row.created_at),
    type: mapped.type,
    reference: row.paystack_reference?.trim() || row.source_id.slice(0, 8),
    invoiceNumber: row.invoice_number,
    description: mapped.description,
    debitCents: mapped.debitCents,
    creditCents: mapped.creditCents,
    status: mapped.status,
  };
}

export function computeOpeningBalanceCents(lines: RawStatementLine[], periodStart: string): number {
  let balance = 0;
  for (const line of lines) {
    if (!beforePeriod(line.date, periodStart)) continue;
    balance += line.debitCents - line.creditCents;
  }
  return balance;
}

export function applyRunningBalances(
  lines: RawStatementLine[],
  openingBalanceCents: number,
): CorporateStatementLineItem[] {
  let balance = openingBalanceCents;
  const sorted = [...lines].sort((a, b) => {
    const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  return sorted.map((line) => {
    balance += line.debitCents - line.creditCents;
    return { ...line, balanceCents: balance };
  });
}

export function computeCorporateStatementSummary(
  scope: CustomerScope,
  periodStart: string,
  periodEnd: string,
  openingBalanceCents: number,
  periodLines: RawStatementLine[],
  closingBalanceCents: number,
): CorporateStatementSummary {
  let invoiceChargesCents = 0;
  let paymentsCents = 0;
  let refundsCreditsCents = 0;
  let outstandingCount = 0;
  let paidCount = 0;

  for (const line of periodLines) {
    invoiceChargesCents += line.debitCents;
    if (line.type === "payment" || line.type === "saved_card_payment") {
      paymentsCents += line.creditCents;
    }
    if (line.type === "refund_credit") {
      refundsCreditsCents += line.creditCents;
    }
    if (line.status === "outstanding" || line.status === "pending") outstandingCount += 1;
    if (line.status === "paid" || line.status === "credited") paidCount += 1;
  }

  return {
    customerLabel: scope.customerLabel,
    customerEmail: scope.customerEmail,
    periodStart,
    periodEnd,
    openingBalanceCents,
    invoiceChargesCents,
    paymentsCents,
    refundsCreditsCents,
    closingBalanceCents,
    outstandingCount,
    paidCount,
  };
}

async function loadCorporateStatementRawLines(
  client: SupabaseClient<Database>,
  scope: CustomerScope,
): Promise<RawStatementLine[]> {
  const [
    invoiceResult,
    authChargeResult,
    salesSyncResult,
    refundResult,
  ] = await Promise.all([
    client
      .from("zoho_invoice_payments")
      .select(
        "id, invoice_number, customer_name, customer_email, amount_cents, status, paystack_reference, created_at, paid_at",
      )
      .order("created_at", { ascending: false })
      .limit(FETCH_CAP),
    client
      .from("zoho_invoice_authorization_charges")
      .select(
        "id, invoice_number, customer_email, amount_cents, status, paystack_reference, created_at, paid_at",
      )
      .order("created_at", { ascending: false })
      .limit(FETCH_CAP),
    client.from("zoho_sales_sync").select("*").limit(FETCH_CAP),
    client
      .from("zoho_refund_credit_sync")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(FETCH_CAP),
  ]);

  if (invoiceResult.error) throw new Error(invoiceResult.error.message);
  if (authChargeResult.error) throw new Error(authChargeResult.error.message);
  if (salesSyncResult.error) throw new Error(salesSyncResult.error.message);
  if (refundResult.error) throw new Error(refundResult.error.message);

  const invoiceRows = (invoiceResult.data ?? []) as ZohoInvoicePaymentRow[];
  const syncRows = (salesSyncResult.data ?? []) as ZohoSalesSyncRow[];
  const expandedScope = expandScopeFromRecords(scope, invoiceRows, syncRows);

  const syncByBookingId = new Map<string, ZohoSalesSyncRow>();
  for (const row of syncRows) {
    if (row.booking_id) syncByBookingId.set(row.booking_id, row);
  }

  const lines: RawStatementLine[] = [];

  for (const row of invoiceRows) {
    if (
      rowMatchesScope(expandedScope, {
        customerEmail: row.customer_email,
        customerName: row.customer_name,
      })
    ) {
      lines.push(mapZohoInvoiceRow(row));
    }
  }

  for (const row of authChargeResult.data ?? []) {
    const charge = row as ZohoInvoiceAuthorizationChargeRow;
    if (rowMatchesScope(expandedScope, { customerEmail: charge.customer_email })) {
      lines.push(mapAuthChargeRow(charge));
    }
  }

  const bookingIds = [...expandedScope.bookingIds];
  for (const syncRow of syncRows) {
    if (
      syncRow.booking_id &&
      (expandedScope.zohoCustomerIds.has(syncRow.zoho_customer_id ?? "") ||
        expandedScope.bookingIds.has(syncRow.booking_id))
    ) {
      bookingIds.push(syncRow.booking_id);
    }
  }

  const uniqueBookingIds = [...new Set(bookingIds)];
  if (uniqueBookingIds.length > 0) {
    const { data: payments, error } = await client
      .from("payments")
      .select(
        "id, booking_id, status, amount_cents, currency, provider, provider_ref, created_at, updated_at",
      )
      .in("booking_id", uniqueBookingIds)
      .in("status", ["paid", "refunded", "pending", "failed", "initialized"])
      .limit(FETCH_CAP);

    if (error) throw new Error(error.message);

    for (const payment of (payments ?? []) as PaymentRow[]) {
      const sync = syncByBookingId.get(payment.booking_id);
      lines.push(
        mapBookingPaymentRow(payment, sync?.invoice_number ?? null),
      );
    }
  }

  for (const row of (refundResult.data ?? []) as ZohoRefundCreditSyncRow[]) {
    const sync = row.booking_id ? syncByBookingId.get(row.booking_id) : null;
    if (
      rowMatchesScope(expandedScope, {
        bookingId: row.booking_id,
        zohoCustomerId: sync?.zoho_customer_id ?? null,
      }) ||
      (row.invoice_number &&
        lines.some((line) => line.invoiceNumber === row.invoice_number))
    ) {
      lines.push(mapRefundRow(row));
    }
  }

  const seen = new Set<string>();
  return lines.filter((line) => {
    if (seen.has(line.id)) return false;
    seen.add(line.id);
    return true;
  });
}

async function buildCorporateStatementResult(
  filters: CorporateStatementFilters,
  client: SupabaseClient<Database>,
): Promise<CorporateStatementResult> {
  const scope = buildCustomerScope(filters);
  const allLines = await loadCorporateStatementRawLines(client, scope);

  const openingBalanceCents = computeOpeningBalanceCents(allLines, filters.from);
  const periodRawLines = allLines.filter((line) => inPeriod(line.date, filters.from, filters.to));
  const withBalances = applyRunningBalances(periodRawLines, openingBalanceCents);
  const closingBalanceCents =
    withBalances.length > 0
      ? withBalances[withBalances.length - 1]!.balanceCents
      : openingBalanceCents;

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  const items = withBalances.slice(0, limit);

  const summary = computeCorporateStatementSummary(
    scope,
    filters.from,
    filters.to,
    openingBalanceCents,
    periodRawLines,
    closingBalanceCents,
  );

  return {
    summary,
    items,
    openingBalanceNote:
      "Opening balance reflects Shalean-recorded activity before this period, not the full Zoho Books ledger unless Zoho statement sync is added.",
  };
}

export async function loadCorporateStatement(
  filters: CorporateStatementFilters,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CorporateStatementResult> {
  try {
    const result = await buildCorporateStatementResult(filters, client);

    logCorporateStatementEvent("corporate_statement_loaded", {
      itemCount: result.items.length,
      transactionCount: result.items.length,
      customerLabel: result.summary.customerLabel,
    });

    return result;
  } catch {
    logCorporateStatementEvent("corporate_statement_failed", { stage: "load" });
    throw new Error("Could not load corporate statement.");
  }
}

export async function loadCorporateStatementForExport(
  filters: CorporateStatementFilters,
  client: SupabaseClient<Database> = requireServiceRoleClient(),
): Promise<CorporateStatementResult> {
  return buildCorporateStatementResult({ ...filters, limit: 500 }, client);
}

/** @internal exported for tests */
export type { RawStatementLine };
