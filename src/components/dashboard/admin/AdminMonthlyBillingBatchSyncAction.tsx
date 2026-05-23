"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { syncMonthlyInvoicePaymentStatusForBatch } from "@/features/monthly-billing/api";
import type { MonthlyInvoiceBatchListItem } from "@/features/monthly-billing/server/monthlyInvoiceBatchReadModel";
import { readBatchPaymentSyncMetadata } from "@/features/monthly-billing/server/monthlyInvoicePaymentSyncTypes";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA");
}

type Props = {
  row: MonthlyInvoiceBatchListItem;
  syncEnabled: boolean;
};

export function AdminMonthlyBillingBatchSyncAction({ row, syncEnabled }: Props) {
  const router = useRouter();
  const errorId = useId();
  const idempotencyRef = useRef(crypto.randomUUID());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const syncable =
    row.status === "generated" || row.status === "sent" || row.status === "overdue";
  const paymentSync = readBatchPaymentSyncMetadata(row.metadata ?? {});

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setConfirmed(false);
  }, []);

  const onSync = async () => {
    if (!confirmed) {
      setError("Confirm you want to sync payment status from Zoho.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await syncMonthlyInvoicePaymentStatusForBatch(row.batchId, {
      idempotencyKey: idempotencyRef.current,
      confirmSync: true,
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

  if (!syncEnabled) {
    return null;
  }

  if (row.status === "paid") {
    return (
      <div className="space-y-1 text-xs text-emerald-800" data-testid="monthly-billing-batch-paid">
        <p className="font-medium">Paid</p>
        <p>Paid at: {formatDateTime(row.paidAt)}</p>
        <p>Items paid: {row.paidItemCount ?? row.itemCount}</p>
      </div>
    );
  }

  if (row.status === "void") {
    return (
      <span className="text-xs text-zinc-600" data-testid="monthly-billing-batch-void">
        Void
      </span>
    );
  }

  if (!syncable) {
    return <span className="text-xs text-zinc-400">—</span>;
  }

  return (
    <div className="space-y-1">
      {paymentSync.lastError ? (
        <p
          className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800"
          data-testid="monthly-billing-payment-sync-failed-alert"
          role="alert"
        >
          Payment sync failed — retry or check Zoho.
        </p>
      ) : null}
      {paymentSync.lastCheckedAt ? (
        <p className="text-xs text-zinc-500">
          Last checked: {formatDateTime(paymentSync.lastCheckedAt)}
          {paymentSync.lastSource ? ` · ${paymentSync.lastSource}` : ""}
        </p>
      ) : null}
      <button
        type="button"
        className="inline-flex min-h-8 items-center rounded-lg border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-900 hover:bg-zinc-50"
        data-testid={`monthly-billing-sync-payment-${row.batchId.slice(0, 8)}`}
        onClick={() => setOpen(true)}
      >
        Sync payment status
      </button>

      {open ? (
        <div
          className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm"
          data-testid="monthly-billing-sync-payment-modal"
        >
          <p className="font-medium text-zinc-900">Sync payment status</p>
          <p className="mt-1 text-xs text-zinc-700">
            Checks Shalean pay-page payments first, then Zoho Books invoice status.
          </p>
          <label className="mt-2 flex items-start gap-2 text-xs text-zinc-800">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>I confirm syncing payment status for this batch.</span>
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
              onClick={() => void onSync()}
            >
              {loading ? "Syncing…" : "Confirm sync"}
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
