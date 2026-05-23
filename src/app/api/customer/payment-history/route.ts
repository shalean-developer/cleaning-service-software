import { NextResponse } from "next/server";
import { isApiAuthFailure, requireApiUser } from "@/features/dashboards/server/apiAuth";
import { CUSTOMER_PAYMENT_HISTORY_MAX_LIMIT } from "@/features/customer-payments/customerPaymentHistoryTypes";
import { loadCustomerPaymentHistoryForUser } from "@/features/customer-payments/server/customerPaymentHistory";
import type {
  CustomerPaymentHistorySourceFilter,
  CustomerPaymentHistoryStatusFilter,
} from "@/features/customer-payments/customerPaymentHistoryTypes";

const SOURCE_FILTERS = new Set<CustomerPaymentHistorySourceFilter>([
  "all",
  "booking",
  "zoho_invoice",
  "saved_card_invoice",
]);

const STATUS_FILTERS = new Set<CustomerPaymentHistoryStatusFilter>([
  "all",
  "paid",
  "pending",
  "failed",
]);

function readQueryParam(url: URL, key: string): string | undefined {
  const value = url.searchParams.get(key)?.trim();
  return value || undefined;
}

export async function GET(request: Request) {
  const user = await requireApiUser(["customer"]);
  if (isApiAuthFailure(user)) {
    return NextResponse.json(
      { ok: false, error: user.error, message: user.message },
      { status: user.status },
    );
  }

  const customerEmail = user.authUser.email?.trim();
  if (!customerEmail) {
    return NextResponse.json(
      {
        ok: false,
        error: "MISSING_EMAIL",
        message: "Your account does not have an email address.",
      },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const sourceParam = readQueryParam(url, "source") ?? "all";
  const statusParam = readQueryParam(url, "status") ?? "all";
  const limitParam = readQueryParam(url, "limit");
  const cursor = readQueryParam(url, "cursor") ?? null;

  if (!SOURCE_FILTERS.has(sourceParam as CustomerPaymentHistorySourceFilter)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_SOURCE", message: "Invalid source filter." },
      { status: 400 },
    );
  }

  if (!STATUS_FILTERS.has(statusParam as CustomerPaymentHistoryStatusFilter)) {
    return NextResponse.json(
      { ok: false, error: "INVALID_STATUS", message: "Invalid status filter." },
      { status: 400 },
    );
  }

  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  if (
    limitParam &&
    (!Number.isFinite(parsedLimit) ||
      parsedLimit! < 1 ||
      parsedLimit! > CUSTOMER_PAYMENT_HISTORY_MAX_LIMIT)
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVALID_LIMIT",
        message: `Limit must be between 1 and ${CUSTOMER_PAYMENT_HISTORY_MAX_LIMIT}.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await loadCustomerPaymentHistoryForUser(user, {
      source: sourceParam as CustomerPaymentHistorySourceFilter,
      status: statusParam as CustomerPaymentHistoryStatusFilter,
      limit: parsedLimit,
      cursor,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "LOAD_FAILED",
        message: "Could not load payment history.",
      },
      { status: 500 },
    );
  }
}
