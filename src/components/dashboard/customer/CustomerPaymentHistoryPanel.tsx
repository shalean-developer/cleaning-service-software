"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { formatZar } from "@/features/dashboards/server/parseBookingDisplay";
import { labelForCustomerPaymentHistoryStatus } from "@/features/customer-payments/customerPaymentHistoryLabels";
import type {
  CustomerPaymentHistoryItem,
  CustomerPaymentHistorySourceFilter,
  CustomerPaymentHistoryStatusFilter,
} from "@/features/customer-payments/customerPaymentHistoryTypes";

type HistoryResponse = {
  ok: boolean;
  items?: CustomerPaymentHistoryItem[];
  nextCursor?: string | null;
  message?: string;
};

function toneForHistoryStatus(
  status: CustomerPaymentHistoryItem["status"],
): "success" | "warning" | "danger" {
  switch (status) {
    case "paid":
      return "success";
    case "pending":
      return "warning";
    case "failed":
      return "danger";
  }
}

function sourceLabel(source: CustomerPaymentHistoryItem["source"]): string {
  switch (source) {
    case "booking":
      return "Booking";
    case "zoho_invoice":
      return "Invoice";
    case "saved_card_invoice":
      return "Saved-card charge";
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-ZA", { dateStyle: "medium" });
  } catch {
    return value;
  }
}

const SOURCE_FILTERS: Array<{ id: CustomerPaymentHistorySourceFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "booking", label: "Bookings" },
  { id: "zoho_invoice", label: "Invoices" },
  { id: "saved_card_invoice", label: "Saved-card charges" },
];

const STATUS_FILTERS: Array<{ id: CustomerPaymentHistoryStatusFilter; label: string }> = [
  { id: "all", label: "All statuses" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "failed", label: "Failed" },
];

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-shalean-primary text-white"
          : "border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {label}
    </button>
  );
}

export function CustomerPaymentHistoryPanel() {
  const [source, setSource] = useState<CustomerPaymentHistorySourceFilter>("all");
  const [status, setStatus] = useState<CustomerPaymentHistoryStatusFilter>("all");
  const [items, setItems] = useState<CustomerPaymentHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (source !== "all") params.set("source", source);
    if (status !== "all") params.set("status", status);
    return params.toString();
  }, [source, status]);

  const loadHistory = useCallback(
    async (cursor?: string | null, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams(queryString);
        if (cursor) params.set("cursor", cursor);
        const response = await fetch(
          `/api/customer/payment-history${params.toString() ? `?${params.toString()}` : ""}`,
        );
        const body = (await response.json()) as HistoryResponse;
        if (!response.ok || !body.ok) {
          setError(body.message ?? "Could not load payment history.");
          if (!append) setItems([]);
          return;
        }
        setItems((current) => (append ? [...current, ...(body.items ?? [])] : body.items ?? []));
        setNextCursor(body.nextCursor ?? null);
      } catch {
        setError("Could not load payment history.");
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [queryString],
  );

  useEffect(() => {
    void loadHistory(null, false);
  }, [loadHistory]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              active={source === filter.id}
              onClick={() => setSource(filter.id)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              active={status === filter.id}
              onClick={() => setStatus(filter.id)}
            />
          ))}
        </div>
      </div>

      {loading ? <p className="text-sm text-zinc-600">Loading payment history…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!loading && !error && items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-8 text-center text-sm text-zinc-600">
          No payment history yet.
        </div>
      ) : null}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">{item.title}</p>
                <p className="mt-1 text-xs text-zinc-500">{sourceLabel(item.source)}</p>
              </div>
              <StatusBadge
                label={labelForCustomerPaymentHistoryStatus(item.status)}
                tone={toneForHistoryStatus(item.status)}
                variant="soft"
              />
            </div>

            <p className="mt-3 text-lg font-semibold tabular-nums text-zinc-900">
              {formatZar(item.amountCents, item.currency)}
            </p>

            <dl className="mt-3 grid gap-2 text-xs text-zinc-600 sm:grid-cols-2">
              <div>
                <dt className="font-medium text-zinc-500">Date</dt>
                <dd>{formatDate(item.paidAt ?? item.createdAt)}</dd>
              </div>
              {item.invoiceNumber ? (
                <div>
                  <dt className="font-medium text-zinc-500">Invoice</dt>
                  <dd>{item.invoiceNumber}</dd>
                </div>
              ) : null}
              {item.reference ? (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-zinc-500">Reference</dt>
                  <dd className="truncate font-mono text-[11px]">{item.reference}</dd>
                </div>
              ) : null}
              {item.paymentMethodLabel ? (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-zinc-500">Payment method</dt>
                  <dd>{item.paymentMethodLabel}</dd>
                </div>
              ) : null}
            </dl>

            {item.actionUrl ? (
              <div className="mt-4">
                <Link
                  href={item.actionUrl}
                  className="text-sm font-semibold text-shalean-primary hover:underline"
                >
                  {item.source === "booking" ? "View booking" : "View invoice"}
                </Link>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {nextCursor ? (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void loadHistory(nextCursor, true)}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 disabled:opacity-60"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
