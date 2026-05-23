"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { sendMonthlyInvoiceReminderForBatch } from "@/features/monthly-billing/api";
import type { MonthlyInvoiceBatchListItem } from "@/features/monthly-billing/server/monthlyInvoiceBatchReadModel";
import { readMonthlyInvoiceOperationsMetadata } from "@/features/monthly-billing/monthlyInvoiceOperationsMetadata";

type Props = {
  row: MonthlyInvoiceBatchListItem;
  operationsEnabled: boolean;
};

export function AdminMonthlyBillingBatchReminderAction({ row, operationsEnabled }: Props) {
  const router = useRouter();
  const errorId = useId();
  const idempotencyRef = useRef(crypto.randomUUID());
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const ops = readMonthlyInvoiceOperationsMetadata(row.metadata ?? {});

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    setConfirmed(false);
  }, []);

  const onSend = async () => {
    if (!confirmed) {
      setError("Confirm you want to send a payment reminder.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await sendMonthlyInvoiceReminderForBatch(row.batchId, {
      idempotencyKey: idempotencyRef.current,
      confirmReminder: true,
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

  if (!operationsEnabled || (row.status !== "sent" && row.status !== "overdue")) {
    return null;
  }

  return (
    <div className="space-y-1">
      {ops.reminderCount > 0 ? (
        <p className="text-xs text-zinc-500">Reminders sent: {ops.reminderCount}</p>
      ) : null}
      <button
        type="button"
        className="inline-flex min-h-8 items-center rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-950 hover:bg-amber-100"
        data-testid={`monthly-billing-send-reminder-${row.batchId.slice(0, 8)}`}
        onClick={() => setOpen(true)}
      >
        Send reminder
      </button>

      {open ? (
        <ReminderConfirmPanel
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

function ReminderConfirmPanel({
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
      data-testid="monthly-billing-send-reminder-modal"
    >
      <p className="font-medium text-zinc-900">Send payment reminder</p>
      <p className="mt-1 text-xs text-zinc-700">
        Reuses the existing Shalean payment link. Does not create a new invoice or payment.
      </p>
      <label className="mt-2 flex items-start gap-2 text-xs text-zinc-800">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>I confirm sending a payment reminder to the customer.</span>
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
          {loading ? "Sending…" : "Confirm reminder"}
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
