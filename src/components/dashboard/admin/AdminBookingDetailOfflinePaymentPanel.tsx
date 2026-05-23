"use client";

import { useCallback, useId, useRef, useState } from "react";
import { recordAdminOfflinePayment } from "@/features/admin-booking-wizard/api";
import type { AdminOfflinePaymentRail } from "@/features/bookings/server/admin/adminOfflinePaymentTypes";
import { isAdminAssistPaymentLinkActive } from "@/features/bookings/server/admin/adminAssistPaymentLinkMetadata";
import type { AdminAssistPaymentLinkMetadata } from "@/features/bookings/server/admin/adminAssistPaymentLinkMetadata";

type Props = {
  bookingId: string;
  customerId: string;
  amountCents: number;
  offlinePaymentsEnabled: boolean;
  activePaymentLink: AdminAssistPaymentLinkMetadata | null;
};

const RAIL_LABELS: Record<AdminOfflinePaymentRail, string> = {
  eft: "EFT",
  cash: "Cash",
  card_machine: "Card machine",
};

export function AdminBookingDetailOfflinePaymentPanel({
  bookingId,
  customerId,
  amountCents,
  offlinePaymentsEnabled,
  activePaymentLink,
}: Props) {
  const idempotencyRef = useRef(crypto.randomUUID());
  const errorId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ rail: string; reference: string } | null>(null);
  const [rail, setRail] = useState<AdminOfflinePaymentRail>("eft");
  const [receivedAt, setReceivedAt] = useState("");
  const [evidenceReference, setEvidenceReference] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [terminalReference, setTerminalReference] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [confirmActiveLink, setConfirmActiveLink] = useState(false);

  const hasActiveLink = activePaymentLink ? isAdminAssistPaymentLinkActive(activePaymentLink) : false;

  const onSubmit = useCallback(async () => {
    if (!confirmed) {
      setError("Confirm you have received and reconciled this payment.");
      return;
    }
    if (!receivedAt.trim()) {
      setError("Received date and time are required.");
      return;
    }
    const receivedIso = new Date(receivedAt).toISOString();
    if (Number.isNaN(Date.parse(receivedIso))) {
      setError("Received date and time are invalid.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await recordAdminOfflinePayment(bookingId, {
        customerId,
        amountCents,
        rail,
        receivedAt: receivedIso,
        evidenceReference: evidenceReference.trim(),
        reason: reason.trim(),
        idempotencyKey: idempotencyRef.current,
        notes: notes.trim() || undefined,
        bankReference: rail === "eft" ? bankReference.trim() : undefined,
        terminalReference: rail === "card_machine" ? terminalReference.trim() : undefined,
        receiptNumber: rail === "cash" ? receiptNumber.trim() : undefined,
        confirmSupersedesActivePaymentLink: hasActiveLink ? confirmActiveLink : undefined,
        sopConfirmed: true as const,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess({ rail: result.payment.rail, reference: result.payment.reference });
      setOpen(false);
    } catch {
      setError("Could not record offline payment.");
    } finally {
      setLoading(false);
    }
  }, [
    amountCents,
    bankReference,
    bookingId,
    confirmActiveLink,
    confirmed,
    customerId,
    evidenceReference,
    hasActiveLink,
    notes,
    rail,
    reason,
    receiptNumber,
    receivedAt,
    terminalReference,
  ]);

  if (!offlinePaymentsEnabled || amountCents <= 0) {
    return null;
  }

  if (success) {
    return (
      <div
        className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-sm text-emerald-950"
        data-testid="admin-booking-offline-payment-success"
      >
        <p className="font-medium">Offline payment recorded</p>
        <p className="mt-1 text-xs">
          {RAIL_LABELS[success.rail as AdminOfflinePaymentRail] ?? success.rail} · Ref{" "}
          {success.reference}
        </p>
        <p className="mt-2 text-xs">Booking is confirmed. Assignment proceeds via normal post-payment flow.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950"
      data-testid="admin-booking-offline-payment-panel"
    >
      <p className="font-medium">Record offline payment</p>
      <p className="mt-1 text-xs text-amber-900/90" data-testid="admin-booking-offline-payment-warning">
        Recording this payment will finalize the booking and start normal assignment after confirmation.
        Assignment only begins after payment confirmation — never before.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex min-h-9 items-center rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
          data-testid="admin-booking-offline-payment-open"
        >
          Record offline payment
        </button>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit();
          }}
        >
          <label className="block text-xs font-medium">
            Payment rail
            <select
              value={rail}
              onChange={(e) => setRail(e.target.value as AdminOfflinePaymentRail)}
              className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
              data-testid="admin-booking-offline-payment-rail"
            >
              <option value="eft">EFT</option>
              <option value="cash">Cash</option>
              <option value="card_machine">Card machine</option>
            </select>
          </label>

          <label className="block text-xs font-medium">
            Amount (ZAR cents, must match booking)
            <input
              type="number"
              readOnly
              value={amountCents}
              className="mt-1 w-full rounded-lg border border-amber-200 bg-amber-50/50 px-2 py-1.5 text-sm"
              data-testid="admin-booking-offline-payment-amount"
            />
          </label>

          <label className="block text-xs font-medium">
            Received at
            <input
              type="datetime-local"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
              data-testid="admin-booking-offline-payment-received-at"
              required
            />
          </label>

          <label className="block text-xs font-medium">
            Evidence reference
            <input
              type="text"
              value={evidenceReference}
              onChange={(e) => setEvidenceReference(e.target.value)}
              className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
              data-testid="admin-booking-offline-payment-evidence"
              required
            />
          </label>

          {rail === "eft" ? (
            <label className="block text-xs font-medium">
              Bank reference
              <input
                type="text"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
                className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
                data-testid="admin-booking-offline-payment-bank-reference"
                required
              />
            </label>
          ) : null}

          {rail === "card_machine" ? (
            <label className="block text-xs font-medium">
              Terminal reference
              <input
                type="text"
                value={terminalReference}
                onChange={(e) => setTerminalReference(e.target.value)}
                className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
                data-testid="admin-booking-offline-payment-terminal-reference"
                required
              />
            </label>
          ) : null}

          {rail === "cash" ? (
            <label className="block text-xs font-medium">
              Receipt number
              <input
                type="text"
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
                data-testid="admin-booking-offline-payment-receipt-number"
                required
              />
            </label>
          ) : null}

          <label className="block text-xs font-medium">
            Reason
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
              data-testid="admin-booking-offline-payment-reason"
              required
            />
          </label>

          <label className="block text-xs font-medium">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm"
              data-testid="admin-booking-offline-payment-notes"
            />
          </label>

          {hasActiveLink ? (
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={confirmActiveLink}
                onChange={(e) => setConfirmActiveLink(e.target.checked)}
                data-testid="admin-booking-offline-payment-confirm-active-link"
              />
              <span>An active Paystack link exists. I am recording offline payment instead.</span>
            </label>
          ) : null}

          <label className="flex items-start gap-2 text-xs font-medium">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              data-testid="admin-booking-offline-payment-confirm"
              required
            />
            <span>
              I verified this payment against{" "}
              {rail === "eft" ? "bank records" : rail === "cash" ? "cash/till records" : "card terminal batch"}{" "}
              before recording.
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading || !confirmed}
              className="rounded-lg bg-amber-900 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              data-testid="admin-booking-offline-payment-submit"
            >
              {loading ? "Recording…" : "Record payment"}
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setOpen(false)}
              className="rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error ? (
        <p id={errorId} className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
