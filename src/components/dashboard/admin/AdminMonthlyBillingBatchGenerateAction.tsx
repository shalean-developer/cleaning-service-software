"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { generateZohoMonthlyInvoiceForBatch } from "@/features/monthly-billing/api";
import type { MonthlyInvoiceBatchListItem } from "@/features/monthly-billing/server/monthlyInvoiceBatchReadModel";

function formatZar(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

type Props = {
  row: MonthlyInvoiceBatchListItem;
  generationEnabled: boolean;
};

export function AdminMonthlyBillingBatchGenerateAction({ row, generationEnabled }: Props) {
  const router = useRouter();
  const errorId = useId();
  const idempotencyRef = useRef(crypto.randomUUID());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const readyForGeneration =
    row.status === "draft" && row.itemCount > 0 && row.invoiceReadinessLabel.includes("ready");

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setConfirmed(false);
  }, []);

  const onGenerate = async () => {
    if (!confirmed) {
      setError("Confirm you reviewed the completed visits and invoice total.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await generateZohoMonthlyInvoiceForBatch(row.batchId, {
      idempotencyKey: idempotencyRef.current,
      confirmReviewed: true,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    idempotencyRef.current = crypto.randomUUID();
    close();
    router.refresh();
  };

  if (!generationEnabled) {
    return (
      <span className="text-xs text-zinc-500" data-testid="monthly-billing-generation-disabled">
        Zoho invoice generation is disabled.
      </span>
    );
  }

  if (row.status === "generated" || row.status === "sent" || row.status === "overdue" || row.status === "paid") {
    return (
      <div className="space-y-1 text-xs text-zinc-700" data-testid="monthly-billing-batch-generated">
        <p>
          Zoho invoice:{" "}
          <span className="font-mono">{row.zohoInvoiceNumber ?? row.zohoInvoiceId ?? "—"}</span>
        </p>
      </div>
    );
  }

  if (!readyForGeneration) {
    return <span className="text-xs text-zinc-400">—</span>;
  }

  return (
    <div>
      <button
        type="button"
        className="inline-flex min-h-8 items-center rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800"
        data-testid={`monthly-billing-generate-invoice-${row.batchId.slice(0, 8)}`}
        onClick={() => setOpen(true)}
      >
        Generate Zoho invoice
      </button>

      {open ? (
        <div
          className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm"
          data-testid="monthly-billing-generate-invoice-modal"
        >
          <p className="font-medium text-zinc-900">Generate consolidated Zoho invoice</p>
          <ul className="mt-2 space-y-1 text-xs text-zinc-700">
            <li>Customer: {row.customerName ?? row.customerId.slice(0, 8)}</li>
            <li>Billing month: {row.billingMonth}</li>
            <li>Total: {formatZar(row.totalCents)}</li>
            <li>Items: {row.itemCount}</li>
          </ul>
          <p
            className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-950"
            data-testid="monthly-billing-generate-invoice-warning"
          >
            This creates an official Zoho invoice. It does not mark the invoice paid.
          </p>
          <label className="mt-2 flex items-start gap-2 text-xs text-zinc-800">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>I reviewed the completed visits and invoice total.</span>
          </label>
          {error ? (
            <p id={errorId} className="mt-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={loading}
              className="inline-flex min-h-8 items-center rounded-lg bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
              onClick={() => void onGenerate()}
            >
              {loading ? "Generating…" : "Confirm generate"}
            </button>
            <button
              type="button"
              className="inline-flex min-h-8 items-center rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-white"
              onClick={close}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
