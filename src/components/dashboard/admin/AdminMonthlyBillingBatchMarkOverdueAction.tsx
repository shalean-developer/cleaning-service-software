"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markMonthlyInvoiceOverdueForBatch } from "@/features/monthly-billing/api";
import type { MonthlyInvoiceBatchListItem } from "@/features/monthly-billing/server/monthlyInvoiceBatchReadModel";

type Props = {
  row: MonthlyInvoiceBatchListItem;
  operationsEnabled: boolean;
};

export function AdminMonthlyBillingBatchMarkOverdueAction({ row, operationsEnabled }: Props) {
  const router = useRouter();
  const errorId = useId();
  const idempotencyRef = useRef(crypto.randomUUID());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setConfirmed(false);
  }, []);

  const onMark = async () => {
    if (!confirmed) {
      setError("Confirm you want to mark this invoice overdue.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await markMonthlyInvoiceOverdueForBatch(row.batchId, {
      idempotencyKey: idempotencyRef.current,
      confirmOverdue: true,
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

  if (!operationsEnabled || (row.status !== "generated" && row.status !== "sent")) {
    return null;
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        className="inline-flex min-h-8 items-center rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-950 hover:bg-red-100"
        data-testid={`monthly-billing-mark-overdue-${row.batchId.slice(0, 8)}`}
        onClick={() => setOpen(true)}
      >
        Mark overdue
      </button>

      {open ? (
        <div
          className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm"
          data-testid="monthly-billing-mark-overdue-modal"
        >
          <p className="font-medium text-zinc-900">Mark overdue</p>
          <p className="mt-1 text-xs text-zinc-700">
            Marks the batch overdue when the due date has passed. Does not affect bookings.
          </p>
          <label className="mt-2 flex items-start gap-2 text-xs text-zinc-800">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>I confirm marking this invoice overdue.</span>
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
              onClick={() => void onMark()}
            >
              {loading ? "Updating…" : "Confirm overdue"}
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
