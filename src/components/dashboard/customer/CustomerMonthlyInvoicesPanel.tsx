"use client";

import { useEffect, useState } from "react";
import type { CustomerMonthlyInvoiceListItem } from "@/features/monthly-billing/server/customerMonthlyInvoicesReadModel";

function formatZar(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currency || "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-ZA", { dateStyle: "medium" });
}

function statusLabel(status: string): string {
  switch (status) {
    case "generated":
      return "Generated";
    case "sent":
      return "Sent";
    case "overdue":
      return "Overdue";
    case "paid":
      return "Paid";
    default:
      return status;
  }
}

function agingLabel(bucket: string): string {
  switch (bucket) {
    case "current":
      return "Current";
    case "1-30":
      return "1–30 days overdue";
    case "31-60":
      return "31–60 days overdue";
    case "61-90":
      return "61–90 days overdue";
    case "90+":
      return "90+ days overdue";
    default:
      return bucket;
  }
}

function InvoiceCard({ invoice }: { invoice: CustomerMonthlyInvoiceListItem }) {
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeMessage, setDisputeMessage] = useState("");
  const [disputeStatus, setDisputeStatus] = useState<"idle" | "submitting" | "sent" | "error">("idle");
  const [disputeError, setDisputeError] = useState<string | null>(null);

  const canDispute =
    invoice.status === "sent" || invoice.status === "overdue" || invoice.status === "generated";

  async function submitDispute() {
    if (disputeMessage.trim().length < 10) {
      setDisputeError("Please provide at least 10 characters describing the issue.");
      setDisputeStatus("error");
      return;
    }
    setDisputeStatus("submitting");
    setDisputeError(null);
    try {
      const response = await fetch(`/api/customer/monthly-invoices/${invoice.batchId}/dispute-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: disputeMessage.trim(),
          idempotencyKey: `dispute:${invoice.batchId}:${Date.now()}`,
        }),
      });
      const json = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !json.ok) {
        setDisputeError(json.message ?? "Could not submit dispute request.");
        setDisputeStatus("error");
        return;
      }
      setDisputeStatus("sent");
      setDisputeOpen(false);
      setDisputeMessage("");
    } catch {
      setDisputeError("Could not submit dispute request.");
      setDisputeStatus("error");
    }
  }

  return (
    <>
      <InvoiceHeader invoice={invoice} formatZar={formatZar} statusLabel={statusLabel} />

      {invoice.isOverdue ? (
        <p
          className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
          data-testid="customer-monthly-invoice-overdue-warning"
          role="alert"
        >
          This invoice is overdue. Please pay as soon as possible to avoid service interruptions.
        </p>
      ) : null}

      {invoice.reminderNotice ? (
        <p className="mt-3 text-sm text-amber-800" data-testid="customer-monthly-invoice-reminder-notice">
          {invoice.reminderNotice}
        </p>
      ) : null}

      {invoice.paymentReceivedMessage ? (
        <p
          className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
          data-testid="customer-monthly-invoice-payment-received"
        >
          {invoice.paymentReceivedMessage}
        </p>
      ) : null}

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">Due date</dt>
          <dd className="font-medium text-zinc-900">{formatDate(invoice.dueDate)}</dd>
        </div>
        <AgingField invoice={invoice} agingLabel={agingLabel} />
        {invoice.paidAt ? (
          <div>
            <dt className="text-zinc-500">Paid</dt>
            <dd className="font-medium text-zinc-900">{formatDate(invoice.paidAt)}</dd>
          </div>
        ) : null}
      </dl>

      {invoice.visitSummaries.length > 0 ? (
        <ul className="mt-3 space-y-1 text-sm text-zinc-700">
          {invoice.visitSummaries.map((visit) => (
            <li key={`${invoice.batchId}-${visit.visitDate}-${visit.serviceLabel}`}>
              {visit.visitDate} · {visit.serviceLabel} · {formatZar(visit.amountCents, invoice.currency)}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {invoice.paymentLink ? (
          <a
            href={invoice.paymentLink}
            className="inline-flex min-h-10 items-center rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            data-testid="customer-monthly-invoice-pay-link"
          >
            Pay invoice
          </a>
        ) : null}
        {invoice.downloadUrl ? (
          <a
            href={invoice.downloadUrl}
            className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
            data-testid="customer-monthly-invoice-download-link"
          >
            View invoice
          </a>
        ) : null}
      </div>

      {invoice.financeSupportEmail ? (
        <p className="mt-3 text-xs text-zinc-600" data-testid="customer-monthly-invoice-finance-support">
          Questions about billing? Contact{" "}
          <a href={`mailto:${invoice.financeSupportEmail}`} className="font-medium underline">
            {invoice.financeSupportEmail}
          </a>
        </p>
      ) : null}

      {canDispute ? (
        <div className="mt-4 border-t border-zinc-100 pt-3">
          {disputeStatus === "sent" ? (
            <p className="text-sm text-emerald-800" data-testid="customer-monthly-invoice-dispute-sent">
              Your dispute request was submitted. Our finance team will follow up.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setDisputeOpen(!disputeOpen)}
                className="text-sm font-medium text-zinc-700 underline"
                data-testid="customer-monthly-invoice-dispute-toggle"
              >
                {disputeOpen ? "Cancel dispute request" : "Dispute this invoice"}
              </button>
              {disputeOpen ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={disputeMessage}
                    onChange={(event) => setDisputeMessage(event.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="Describe the issue with this invoice (minimum 10 characters)."
                    data-testid="customer-monthly-invoice-dispute-message"
                  />
                  {disputeError ? (
                    <p className="text-sm text-red-700" role="alert">
                      {disputeError}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void submitDispute()}
                    disabled={disputeStatus === "submitting"}
                    className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
                    data-testid="customer-monthly-invoice-dispute-submit"
                  >
                    {disputeStatus === "submitting" ? "Submitting…" : "Submit dispute request"}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </>
  );
}

function InvoiceHeader({
  invoice,
  formatZar,
  statusLabel,
}: {
  invoice: CustomerMonthlyInvoiceListItem;
  formatZar: (cents: number, currency: string) => string;
  statusLabel: (status: string) => string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">{invoice.billingMonthLabel}</h2>
        <p className="text-sm text-zinc-600">
          Invoice {invoice.invoiceNumber ?? "pending"} · {formatZar(invoice.totalCents, invoice.currency)}
        </p>
      </div>
      <span
        className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800"
        data-testid="customer-monthly-invoice-status"
      >
        {statusLabel(invoice.status)}
      </span>
    </div>
  );
}

function AgingField({
  invoice,
  agingLabel,
}: {
  invoice: CustomerMonthlyInvoiceListItem;
  agingLabel: (bucket: string) => string;
}) {
  return (
    <div>
      <dt className="text-zinc-500">Aging</dt>
      <dd className="font-medium text-zinc-900" data-testid="customer-monthly-invoice-aging">
        {agingLabel(invoice.agingBucket)}
      </dd>
    </div>
  );
}

export function CustomerMonthlyInvoicesPanel() {
  const [invoices, setInvoices] = useState<CustomerMonthlyInvoiceListItem[]>([]);
  const [financeSupportEmail, setFinanceSupportEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/customer/monthly-invoices");
        const json = (await response.json()) as
          | { ok: true; invoices: CustomerMonthlyInvoiceListItem[]; financeSupportEmail?: string | null }
          | { ok: false; message?: string };
        if (cancelled) return;
        if (!response.ok || !json.ok) {
          setError("message" in json && json.message ? json.message : "Could not load invoices.");
          setInvoices([]);
          return;
        }
        setInvoices(json.invoices);
        setFinanceSupportEmail(json.financeSupportEmail ?? null);
      } catch {
        if (!cancelled) {
          setError("Could not load invoices.");
          setInvoices([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-zinc-600">Loading monthly invoices…</p>;
  }

  if (error) {
    return (
      <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
        {error}
      </p>
    );
  }

  if (invoices.length === 0) {
    return (
      <p className="text-sm text-zinc-600" data-testid="customer-monthly-invoices-empty">
        No monthly invoices yet.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="customer-monthly-invoices-list">
      {financeSupportEmail ? (
        <p className="text-sm text-zinc-600" data-testid="customer-monthly-invoices-finance-support">
          Billing support:{" "}
          <a href={`mailto:${financeSupportEmail}`} className="font-medium underline">
            {financeSupportEmail}
          </a>
        </p>
      ) : null}
      {invoices.map((invoice) => (
        <article
          key={invoice.batchId}
          className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          data-testid={`customer-monthly-invoice-${invoice.batchId.slice(0, 8)}`}
        >
          <InvoiceCard invoice={invoice} />
        </article>
      ))}
    </div>
  );
}
