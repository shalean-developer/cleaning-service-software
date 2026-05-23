"use client";

import type { ZohoInvoicePaymentDiagnosticsResult } from "@/features/zoho-invoice-payments/server/loadZohoInvoicePaymentDiagnostics";
import { paymentRowStatusHelperText } from "@/features/zoho-invoice-payments/server/zohoInvoicePaymentStatusHelperText";
import { AdminZohoCopyLinkButton, AdminZohoOpenLinkButton } from "./AdminZohoPaymentLinkActions";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "failed":
      return "bg-red-50 text-red-800 ring-red-200";
    case "zoho_reconcile_pending":
      return "bg-amber-50 text-amber-900 ring-amber-200";
    case "zoho_reconcile_failed":
      return "bg-orange-50 text-orange-900 ring-orange-200";
    case "pending_paystack":
      return "bg-blue-50 text-blue-800 ring-blue-200";
    default:
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
  }
}

function formatTimestamp(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

type Props = {
  diagnostics: ZohoInvoicePaymentDiagnosticsResult;
};

export function AdminZohoInvoicePaymentsDiagnostics({ diagnostics }: Props) {
  const { summary, payments } = diagnostics;

  const cards = [
    { label: "Paid", value: summary.paid, tone: "text-emerald-700" },
    { label: "Pending checkout", value: summary.pending_paystack, tone: "text-blue-700" },
    {
      label: "Reconciliation pending",
      value: summary.zoho_reconcile_pending,
      tone: "text-amber-700",
    },
    {
      label: "Reconciliation failed",
      value: summary.zoho_reconcile_failed,
      tone: "text-orange-700",
    },
    { label: "Failed payment", value: summary.failed, tone: "text-red-700" },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              {card.label}
            </p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${card.tone}`}>
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-zinc-100 px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-semibold text-zinc-900">Payment health</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Read-only diagnostics. Copy payment links for customer follow-up. No retry or mark-paid
            actions are available on this page.
          </p>
        </div>

        {payments.length === 0 ? (
          <p className="px-4 py-8 text-sm text-zinc-600 sm:px-5">
            No Zoho invoice payment issues found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50/80 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 sm:px-5">Invoice</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                  <th className="px-4 py-3">Retries</th>
                  <th className="px-4 py-3">Next retry</th>
                  <th className="px-4 py-3">Error</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {payments.map((payment) => {
                  const helper = paymentRowStatusHelperText(payment.status);
                  return (
                    <tr
                      key={`${payment.invoiceNumber}-${payment.updatedAt}`}
                      className="align-top text-zinc-800"
                    >
                      <td className="px-4 py-3 font-medium sm:px-5">
                        <div>{payment.invoiceNumber}</div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          View in Zoho Books manually when needed
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{payment.amountDisplay}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(payment.status)}`}
                        >
                          {payment.status.replaceAll("_", " ")}
                        </span>
                        {helper ? (
                          <p className="mt-2 max-w-xs text-xs text-zinc-600">{helper}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <AdminZohoCopyLinkButton
                            url={payment.paymentPageUrl}
                            label="Copy payment link"
                          />
                          <AdminZohoOpenLinkButton
                            url={payment.paymentPageUrl}
                            label="Open customer page"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{payment.reconcileAttempts}</td>
                      <td className="px-4 py-3 text-xs text-zinc-600">
                        {formatTimestamp(payment.nextReconcileAttemptAt)}
                      </td>
                      <td className="max-w-[12rem] px-4 py-3 text-xs text-zinc-600">
                        {payment.safeLastError ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600">
                        {formatTimestamp(payment.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
