"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADMIN_CHARGE_CONFIRM_PHRASE,
  MIN_ADMIN_CHARGE_REASON_LENGTH,
} from "@/features/zoho-invoice-payments/adminChargeConstants";

type EligibleMethod = {
  id: string;
  card_type: string | null;
  bank: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  consented_at: string;
  is_default: boolean;
};

type InvoiceContext = {
  invoiceNumber: string;
  customerName: string | null;
  amountDueDisplay: string;
  canPayNow: boolean;
};

type Props = {
  invoiceContext: InvoiceContext | null;
  adminCardChargesEnabled?: boolean;
};

function formatMethodLabel(method: EligibleMethod): string {
  const brand = method.card_type ?? method.bank ?? "Card";
  const ending = method.last4 ? ` ending ${method.last4}` : "";
  return `${brand}${ending}`;
}

function formatExpiry(method: EligibleMethod): string {
  if (!method.exp_month && !method.exp_year) return "—";
  return `${method.exp_month ?? "??"}/${method.exp_year ?? "??"}`;
}

export function AdminZohoChargeSavedCardFlow({
  invoiceContext,
  adminCardChargesEnabled = false,
}: Props) {
  const [methods, setMethods] = useState<EligibleMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(false);
  const [methodsError, setMethodsError] = useState<string | null>(null);
  const [selectedMethodId, setSelectedMethodId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    reference: string;
    status: string;
  } | null>(null);

  const canShowFlow = Boolean(
    adminCardChargesEnabled && invoiceContext?.canPayNow && invoiceContext.invoiceNumber,
  );

  const selectedMethod = useMemo(
    () => methods.find((method) => method.id === selectedMethodId) ?? null,
    [methods, selectedMethodId],
  );

  const loadEligibleMethods = useCallback(async (invoiceNumber: string) => {
    setLoadingMethods(true);
    setMethodsError(null);
    setMethods([]);
    setSelectedMethodId("");
    setSubmitResult(null);
    setSubmitError(null);
    try {
      const params = new URLSearchParams({ invoiceNumber });
      const response = await fetch(
        `/api/admin/zoho-invoice-payments/eligible-payment-methods?${params.toString()}`,
      );
      const body = (await response.json()) as {
        ok: boolean;
        canCharge?: boolean;
        methods?: EligibleMethod[];
        message?: string;
      };
      if (!response.ok || !body.ok) {
        setMethodsError(body.message ?? "Could not load saved payment methods.");
        return;
      }
      setMethods(body.methods ?? []);
      if (body.methods?.length === 1) {
        setSelectedMethodId(body.methods[0].id);
      }
    } catch {
      setMethodsError("Could not load saved payment methods.");
    } finally {
      setLoadingMethods(false);
    }
  }, []);

  useEffect(() => {
    if (!canShowFlow || !invoiceContext?.invoiceNumber) {
      setMethods([]);
      setSelectedMethodId("");
      return;
    }
    void loadEligibleMethods(invoiceContext.invoiceNumber);
  }, [canShowFlow, invoiceContext?.invoiceNumber, loadEligibleMethods]);

  const reasonValid = reason.trim().length >= MIN_ADMIN_CHARGE_REASON_LENGTH;
  const canReview =
    canShowFlow && methods.length > 0 && selectedMethodId && reasonValid && !submitting;

  const submitCharge = useCallback(async () => {
    if (!invoiceContext?.invoiceNumber || !selectedMethodId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/admin/zoho-invoice-payments/charge-saved-card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: invoiceContext.invoiceNumber,
          paymentMethodId: selectedMethodId,
          reason: reason.trim(),
          confirmPhrase: confirmPhrase.trim(),
        }),
      });
      const body = (await response.json()) as {
        ok: boolean;
        reference?: string;
        status?: string;
        message?: string;
      };
      if (!response.ok || !body.ok || !body.reference) {
        setSubmitError(body.message ?? "Charge could not be submitted.");
        return;
      }
      setSubmitResult({ reference: body.reference, status: body.status ?? "pending_webhook" });
      setConfirmOpen(false);
      setConfirmPhrase("");
    } catch {
      setSubmitError("Charge could not be submitted.");
    } finally {
      setSubmitting(false);
    }
  }, [confirmPhrase, invoiceContext?.invoiceNumber, reason, selectedMethodId]);

  if (!adminCardChargesEnabled) {
    return (
      <section className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-semibold text-zinc-900">Charge saved card</h2>
        <p className="mt-2 text-sm text-zinc-600">
          Admin saved-card charges are disabled globally. Set{" "}
          <code className="rounded bg-zinc-200 px-1 text-xs">ZOHO_ADMIN_CARD_CHARGES_ENABLED=true</code>{" "}
          after final sign-off to enable this flow. Saved methods remain viewable and revocable
          below.
        </p>
      </section>
    );
  }

  if (!canShowFlow) {
    return null;
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-zinc-100 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-semibold text-zinc-900">Charge saved card</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Charge a customer&apos;s saved card for this invoice balance. Amount is always taken from
          live Zoho — you cannot enter a custom amount.
        </p>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-3 text-xs leading-relaxed text-amber-900">
          <p className="font-medium">Consent required</p>
          <p className="mt-1">
            Only charge a saved card when the customer has approved this invoice or the charge is
            covered by an active service agreement.
          </p>
          <p className="mt-2 text-amber-800">
            Do not use this for automatic recurring billing yet.
          </p>
        </div>

        {loadingMethods ? (
          <p className="text-sm text-zinc-600">Loading eligible saved cards…</p>
        ) : null}
        {methodsError ? <p className="text-sm text-red-700">{methodsError}</p> : null}

        {!loadingMethods && methods.length === 0 && !methodsError ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
            No active reusable saved cards match this invoice customer. The customer may need to
            pay an invoice and save a new method, or a previously saved method may have been
            removed.
          </p>
        ) : null}

        {methods.length > 0 ? (
          <div className="space-y-4">
            <fieldset>
              <legend className="text-xs font-medium text-zinc-700">Saved payment method</legend>
              <div className="mt-2 space-y-2">
                {methods.map((method) => (
                  <label
                    key={method.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 px-3 py-2.5"
                  >
                    <input
                      type="radio"
                      name="zoho-charge-payment-method"
                      value={method.id}
                      checked={selectedMethodId === method.id}
                      onChange={() => setSelectedMethodId(method.id)}
                      className="mt-1"
                    />
                    <span className="text-sm text-zinc-900">
                      <span className="font-medium">{formatMethodLabel(method)}</span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        Expires {formatExpiry(method)} · Consented{" "}
                        {new Date(method.consented_at).toLocaleDateString()}
                        {method.is_default ? " · Default" : ""}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div>
              <label htmlFor="zoho-charge-reason" className="text-xs font-medium text-zinc-700">
                Charge reason (required)
              </label>
              <textarea
                id="zoho-charge-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="Customer approved phone/WhatsApp charge for invoice INV-001602"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              />
              <p className="mt-1 text-xs text-zinc-500">
                Minimum {MIN_ADMIN_CHARGE_REASON_LENGTH} characters. Describe how the customer
                approved this charge.
              </p>
            </div>

            <button
              type="button"
              disabled={!canReview}
              onClick={() => {
                setConfirmOpen(true);
                setConfirmPhrase("");
                setSubmitError(null);
              }}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Review charge
            </button>
          </div>
        ) : null}

        {submitError ? <p className="text-sm text-red-700">{submitError}</p> : null}

        {submitResult ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-sm text-emerald-900">
            <p className="font-medium">Charge submitted</p>
            <p className="mt-1 font-mono text-xs">Reference: {submitResult.reference}</p>
            <p className="mt-1 text-xs">Status: {submitResult.status}</p>
          </div>
        ) : null}
      </div>

      {confirmOpen && selectedMethod && invoiceContext ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="zoho-charge-confirm-title"
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <h3 id="zoho-charge-confirm-title" className="text-sm font-semibold text-zinc-900">
              Confirm saved-card charge
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-700">
              This will charge the customer&apos;s saved payment method for the live Zoho invoice
              balance. Only proceed if the customer has approved this invoice or the charge is
              covered by an active service agreement.
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-xs text-zinc-500">Invoice</dt>
                <dd className="font-medium text-zinc-900">{invoiceContext.invoiceNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Customer</dt>
                <dd className="font-medium text-zinc-900">{invoiceContext.customerName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Amount (from Zoho)</dt>
                <dd className="font-medium text-zinc-900">{invoiceContext.amountDueDisplay}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Card</dt>
                <dd className="font-medium text-zinc-900">{formatMethodLabel(selectedMethod)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Reason</dt>
                <dd className="text-zinc-900">{reason.trim()}</dd>
              </div>
            </dl>

            <div className="mt-4">
              <label htmlFor="zoho-charge-confirm-phrase" className="text-xs font-medium text-zinc-700">
                Type {ADMIN_CHARGE_CONFIRM_PHRASE} to confirm
              </label>
              <input
                id="zoho-charge-confirm-phrase"
                type="text"
                value={confirmPhrase}
                onChange={(event) => setConfirmPhrase(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting || confirmPhrase.trim() !== ADMIN_CHARGE_CONFIRM_PHRASE}
                onClick={() => void submitCharge()}
                className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Submitting…" : "Submit charge"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
