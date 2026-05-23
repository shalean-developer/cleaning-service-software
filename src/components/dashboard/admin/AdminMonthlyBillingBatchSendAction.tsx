"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendMonthlyInvoiceForBatch } from "@/features/monthly-billing/api";
import type { MonthlyInvoiceBatchListItem } from "@/features/monthly-billing/server/monthlyInvoiceBatchReadModel";

type Props = {
  row: MonthlyInvoiceBatchListItem;
  operationsEnabled: boolean;
};

export function AdminMonthlyBillingBatchSendAction({ row, operationsEnabled }: Props) {
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

  const onSend = async () => {
    if (!confirmed) {
      setError("Confirm you want to send this invoice to the customer.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await sendMonthlyInvoiceForBatch(row.batchId, {
      idempotencyKey: idempotencyRef.current,
      confirmSend: true,
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

  if (!operationsEnabled || row.status !== "generated") {
    return null;
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        className="inline-flex min-h-8 items-center rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-950 hover:bg-sky-100"
        data-testid={`monthly-billing-send-invoice-${row.batchId.slice(0, 8)}`}
        onClick={() => setOpen(true)}
      >
        Send invoice to customer
      </button>

      {open ? (
        <SendInvoiceConfirmPanel
          error={error}
          errorId={errorId}
          confirmed={confirmed}
          setConfirmed={setConfirmed}
          loading={loading}
          onSend={onSend}
          close={close}
        />
      ) : null}
    </div>
  );
}

function SendInvoiceConfirmPanel({
  error,
  errorId,
  confirmed,
  setConfirmed,
  loading,
  onSend,
  close,
}: {
  error: string | null;
  errorId: string;
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
  loading: boolean;
  onSend: () => void;
  close: () => void;
}) {
  return (
    <div
      className="mt-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm"
      data-testid="monthly-billing-send-invoice-modal"
    >
      <p className="font-medium text-zinc-900">Send invoice to customer</p>
      <p className="mt-1 text-xs text-zinc-700">
        Emails the billing contact with the Shalean payment link. Does not mark the invoice paid.
      </p>
      <label className="mt-2 flex items-start gap-2 text-xs text-zinc-800">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>I confirm sending this monthly invoice to the customer.</span>
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
          onClick={() => void onSend()}
        >
          {loading ? "Sending…" : "Confirm send"}
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
  );
}
