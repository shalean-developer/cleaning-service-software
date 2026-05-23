import "server-only";

import { customerBookingDetailPath } from "@/lib/app/paymentReturn";
import { resolveActorScope } from "@/lib/auth/resolveActorScope";
import type { CurrentUser } from "@/lib/auth/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireServiceRoleClient } from "@/lib/supabase/serviceRole";
import type {
  PaymentRow,
  ZohoInvoiceAuthorizationChargeRow,
  ZohoInvoicePaymentRow,
} from "@/lib/database/types";
import { normalizeCustomerEmailForMatch } from "@/features/zoho-invoice-payments/server/zohoInvoiceCustomerEmailMatch";
import { formatMaskedPaymentMethodDisplay } from "@/features/zoho-invoice-payments/server/zohoInvoicePaymentMethodRepository";
import {
  mapBookingPaymentStatus,
  mapSavedCardInvoiceChargeStatus,
  mapZohoInvoicePaymentStatus,
} from "./mapCustomerPaymentStatus";
import {
  CUSTOMER_PAYMENT_HISTORY_DEFAULT_LIMIT,
  CUSTOMER_PAYMENT_HISTORY_FETCH_CAP,
  CUSTOMER_PAYMENT_HISTORY_MAX_LIMIT,
  type CustomerPaymentHistoryItem,
  type CustomerPaymentHistorySource,
  type CustomerPaymentHistorySourceFilter,
  type CustomerPaymentHistoryStatusFilter,
  type LoadCustomerPaymentHistoryInput,
  type LoadCustomerPaymentHistoryResult,
} from "./customerPaymentHistoryTypes";

type HistoryCursor = {
  sortAt: string;
  id: string;
  source: CustomerPaymentHistorySource;
};

function encodeCursor(cursor: HistoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(raw: string | null | undefined): HistoryCursor | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw.trim(), "base64url").toString("utf8")) as HistoryCursor;
    if (!parsed?.sortAt || !parsed?.id || !parsed?.source) return null;
    return parsed;
  } catch {
    return null;
  }
}

function resolveLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit)) return CUSTOMER_PAYMENT_HISTORY_DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), 1), CUSTOMER_PAYMENT_HISTORY_MAX_LIMIT);
}

function sortTimestamp(item: CustomerPaymentHistoryItem): string {
  return item.paidAt ?? item.createdAt;
}

function compareHistoryItems(a: CustomerPaymentHistoryItem, b: CustomerPaymentHistoryItem): number {
  const aSort = sortTimestamp(a);
  const bSort = sortTimestamp(b);
  if (aSort !== bSort) return bSort.localeCompare(aSort);
  if (a.id !== b.id) return b.id.localeCompare(a.id);
  return a.source.localeCompare(b.source);
}

function isBeforeCursor(item: CustomerPaymentHistoryItem, cursor: HistoryCursor): boolean {
  const itemSort = sortTimestamp(item);
  if (itemSort < cursor.sortAt) return true;
  if (itemSort > cursor.sortAt) return false;
  if (item.id < cursor.id) return true;
  if (item.id > cursor.id) return false;
  return item.source < cursor.source;
}

function bookingPaymentMethodLabel(provider: string | null | undefined): string {
  const normalized = provider?.trim().toLowerCase();
  if (normalized === "paystack") return "Online payment";
  if (normalized) return "Online payment";
  return "Online payment";
}

function mapBookingPaymentRow(payment: PaymentRow): CustomerPaymentHistoryItem {
  const status = mapBookingPaymentStatus(payment.status);
  return {
    id: `booking:${payment.id}`,
    source: "booking",
    title: "Booking payment",
    reference: payment.provider_ref,
    invoiceNumber: null,
    bookingId: payment.booking_id,
    amountCents: payment.amount_cents,
    currency: payment.currency,
    status,
    paidAt: status === "paid" ? payment.updated_at : null,
    createdAt: payment.created_at,
    paymentMethodLabel: bookingPaymentMethodLabel(payment.provider),
    actionUrl: customerBookingDetailPath(payment.booking_id),
  };
}

function mapZohoInvoicePaymentRow(row: ZohoInvoicePaymentRow): CustomerPaymentHistoryItem {
  const status = mapZohoInvoicePaymentStatus(row.status);
  return {
    id: `zoho_invoice:${row.id}`,
    source: "zoho_invoice",
    title: `Invoice ${row.invoice_number}`,
    reference: row.paystack_reference,
    invoiceNumber: row.invoice_number,
    bookingId: null,
    amountCents: row.amount_cents,
    currency: row.currency,
    status,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    paymentMethodLabel: "Paystack checkout",
    actionUrl: `/pay/${encodeURIComponent(row.invoice_number)}`,
  };
}

function mapSavedCardChargeRow(
  row: ZohoInvoiceAuthorizationChargeRow,
  paymentMethodLabel: string | null,
): CustomerPaymentHistoryItem {
  const status = mapSavedCardInvoiceChargeStatus(row.status);
  return {
    id: `saved_card_invoice:${row.id}`,
    source: "saved_card_invoice",
    title: `Saved-card invoice charge`,
    reference: row.paystack_reference,
    invoiceNumber: row.invoice_number,
    bookingId: null,
    amountCents: row.amount_cents,
    currency: row.currency,
    status,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    paymentMethodLabel,
    actionUrl: `/pay/${encodeURIComponent(row.invoice_number)}`,
  };
}

async function loadBookingPaymentHistoryItems(
  actingCustomerId: string,
): Promise<CustomerPaymentHistoryItem[]> {
  const client = await createSupabaseServerClient();
  if (!client) return [];

  const { data: bookings, error: bookingsError } = await client
    .from("bookings")
    .select("id")
    .eq("customer_id", actingCustomerId);

  if (bookingsError) throw new Error(bookingsError.message);

  const bookingIds = (bookings ?? []).map((row) => row.id);
  if (bookingIds.length === 0) return [];

  const chunkSize = 50;
  const payments: PaymentRow[] = [];

  for (let index = 0; index < bookingIds.length; index += chunkSize) {
    const chunk = bookingIds.slice(index, index + chunkSize);
    const { data, error } = await client
      .from("payments")
      .select(
        "id, booking_id, status, amount_cents, currency, provider, provider_ref, created_at, updated_at",
      )
      .in("booking_id", chunk)
      .order("created_at", { ascending: false })
      .limit(CUSTOMER_PAYMENT_HISTORY_FETCH_CAP);

    if (error) throw new Error(error.message);
    payments.push(...((data ?? []) as PaymentRow[]));
  }

  return payments
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, CUSTOMER_PAYMENT_HISTORY_FETCH_CAP)
    .map(mapBookingPaymentRow);
}

async function loadZohoInvoicePaymentHistoryItems(
  customerEmail: string,
): Promise<CustomerPaymentHistoryItem[]> {
  const client = requireServiceRoleClient();
  const normalizedEmail = normalizeCustomerEmailForMatch(customerEmail);

  const { data, error } = await client
    .from("zoho_invoice_payments")
    .select(
      "id, invoice_number, amount_cents, currency, status, paystack_reference, created_at, paid_at",
    )
    .eq("customer_email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(CUSTOMER_PAYMENT_HISTORY_FETCH_CAP);

  if (error) throw new Error(error.message);
  return ((data ?? []) as ZohoInvoicePaymentRow[]).map(mapZohoInvoicePaymentRow);
}

async function loadSavedCardInvoiceChargeHistoryItems(
  customerEmail: string,
): Promise<CustomerPaymentHistoryItem[]> {
  const client = requireServiceRoleClient();
  const normalizedEmail = normalizeCustomerEmailForMatch(customerEmail);

  const { data: charges, error } = await client
    .from("zoho_invoice_authorization_charges")
    .select(
      "id, invoice_number, amount_cents, currency, status, paystack_reference, payment_method_id, created_at, paid_at",
    )
    .eq("customer_email", normalizedEmail)
    .order("created_at", { ascending: false })
    .limit(CUSTOMER_PAYMENT_HISTORY_FETCH_CAP);

  if (error) throw new Error(error.message);

  const rows = (charges ?? []) as ZohoInvoiceAuthorizationChargeRow[];
  if (rows.length === 0) return [];

  const methodIds = [...new Set(rows.map((row) => row.payment_method_id))];
  const { data: methods, error: methodsError } = await client
    .from("zoho_invoice_payment_methods")
    .select("id, card_type, bank, last4")
    .in("id", methodIds);

  if (methodsError) throw new Error(methodsError.message);

  const methodLabels = new Map(
    (methods ?? []).map((method) => [method.id, formatMaskedPaymentMethodDisplay(method)]),
  );

  return rows.map((row) =>
    mapSavedCardChargeRow(row, methodLabels.get(row.payment_method_id) ?? null),
  );
}

function applyFilters(
  items: CustomerPaymentHistoryItem[],
  source: CustomerPaymentHistorySourceFilter,
  status: CustomerPaymentHistoryStatusFilter,
): CustomerPaymentHistoryItem[] {
  return items.filter((item) => {
    if (source !== "all" && item.source !== source) return false;
    if (status !== "all" && item.status !== status) return false;
    return true;
  });
}

export async function loadCustomerPaymentHistory(
  input: LoadCustomerPaymentHistoryInput,
): Promise<LoadCustomerPaymentHistoryResult> {
  const source = input.source ?? "all";
  const status = input.status ?? "all";
  const limit = resolveLimit(input.limit);
  const cursor = decodeCursor(input.cursor);

  const loaders: Promise<CustomerPaymentHistoryItem[]>[] = [];

  if (source === "all" || source === "booking") {
    if (input.actingCustomerId) {
      loaders.push(loadBookingPaymentHistoryItems(input.actingCustomerId));
    }
  }

  if (source === "all" || source === "zoho_invoice") {
    loaders.push(loadZohoInvoicePaymentHistoryItems(input.customerEmail));
  }

  if (source === "all" || source === "saved_card_invoice") {
    loaders.push(loadSavedCardInvoiceChargeHistoryItems(input.customerEmail));
  }

  const batches = await Promise.all(loaders);
  let items = applyFilters(batches.flat(), source, status);
  items.sort(compareHistoryItems);

  if (cursor) {
    items = items.filter((item) => isBeforeCursor(item, cursor));
  }

  const pageItems = items.slice(0, limit);
  const lastItem = pageItems.at(-1);
  const nextCursor =
    items.length > limit && lastItem
      ? encodeCursor({
          sortAt: sortTimestamp(lastItem),
          id: lastItem.id,
          source: lastItem.source,
        })
      : null;

  return { items: pageItems, nextCursor };
}

export async function loadCustomerPaymentHistoryForUser(
  user: CurrentUser,
  options: Omit<LoadCustomerPaymentHistoryInput, "profileId" | "customerEmail" | "actingCustomerId"> = {},
): Promise<LoadCustomerPaymentHistoryResult> {
  const customerEmail = user.authUser.email?.trim();
  if (!customerEmail) {
    return { items: [], nextCursor: null };
  }

  const client = await createSupabaseServerClient();
  if (!client) {
    throw new Error("Supabase not configured.");
  }

  const scope = await resolveActorScope(client, user.profileId, user.role);

  return loadCustomerPaymentHistory({
    profileId: user.profileId,
    customerEmail,
    actingCustomerId: scope.actingCustomerId ?? null,
    ...options,
  });
}
