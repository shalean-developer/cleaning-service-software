"use client";

import { useCallback, useEffect, useState } from "react";

type PaymentMethod = {
  id: string;
  cardType: string | null;
  bank: string | null;
  last4: string | null;
  expMonth: string | null;
  expYear: string | null;
  reusable: boolean;
  isDefault: boolean;
  consentedAt: string;
  revokedAt: string | null;
  sourceInvoiceNumber: string | null;
  lastUsedAt: string | null;
  lastUsedInvoiceNumber: string | null;
};

function formatCardLabel(method: PaymentMethod): string {
  const brand = method.cardType ?? method.bank ?? "Card";
  const ending = method.last4 ? ` ending ${method.last4}` : "";
  return `${brand}${ending}`;
}

function formatExpiry(method: PaymentMethod): string {
  if (!method.expMonth && !method.expYear) return "—";
  return `${method.expMonth ?? "??"}/${method.expYear ?? "??"}`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-ZA", { dateStyle: "medium" });
  } catch {
    return value;
  }
}

export function CustomerPaymentMethodsPanel() {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PaymentMethod | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const loadMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/customer/payment-methods");
      const body = (await response.json()) as {
        ok: boolean;
        methods?: PaymentMethod[];
        message?: string;
      };
      if (!response.ok || !body.ok) {
        setError(body.message ?? "Could not load saved payment methods.");
        setMethods([]);
        return;
      }
      setMethods(body.methods ?? []);
    } catch {
      setError("Could not load saved payment methods.");
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  const submitRevoke = useCallback(async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      const response = await fetch(
        `/api/customer/payment-methods/${revokeTarget.id}/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: revokeReason.trim() || undefined }),
        },
      );
      const body = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !body.ok) {
        setRevokeError(body.message ?? "Could not remove this payment method.");
        return;
      }
      setRevokeTarget(null);
      setRevokeReason("");
      await loadMethods();
    } catch {
      setRevokeError("Could not remove this payment method.");
    } finally {
      setRevoking(false);
    }
  }, [loadMethods, revokeReason, revokeTarget]);

  const activeMethods = methods.filter((method) => !method.revokedAt);

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-600">
        Cards saved when you paid a Zoho invoice and chose to store your payment method for future
        approved charges. Shalean never stores your full card number or CVV.
      </p>

      {loading ? <p className="text-sm text-zinc-600">Loading saved payment methods…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {!loading && !error && methods.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-6 text-sm text-zinc-600">
          You do not have any saved payment methods yet.
        </p>
      ) : null}

      {!loading && methods.length > 0 ? (
        <ul className="space-y-3">
          {methods.map((method) => {
            const isRevoked = Boolean(method.revokedAt);
            return (
              <li
                key={method.id}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{formatCardLabel(method)}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Expires {formatExpiry(method)} · Saved {formatDate(method.consentedAt)}
                      {method.isDefault && !isRevoked ? " · Default" : ""}
                    </p>
                    {method.lastUsedInvoiceNumber ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Last used on invoice {method.lastUsedInvoiceNumber}
                      </p>
                    ) : null}
                    {method.sourceInvoiceNumber ? (
                      <p className="mt-0.5 text-xs text-zinc-500">
                        First saved from invoice {method.sourceInvoiceNumber}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {isRevoked ? (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                        Removed
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRevokeTarget(method);
                          setRevokeReason("");
                          setRevokeError(null);
                        }}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!loading && activeMethods.length === 0 && methods.length > 0 ? (
        <p className="text-xs text-zinc-500">
          All saved methods have been removed. You can save a new payment method during a future
          invoice payment.
        </p>
      ) : null}

      {revokeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-method-title"
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <h3 id="revoke-method-title" className="text-sm font-semibold text-zinc-900">
              Remove this saved payment method?
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600">
              Removing this payment method means Shalean Cleaning Services can no longer charge it
              for approved invoices or recurring cleaning services. You can save a new payment
              method during a future payment.
            </p>
            <p className="mt-2 text-sm font-medium text-zinc-900">{formatCardLabel(revokeTarget)}</p>

            <div className="mt-4">
              <label htmlFor="revoke-reason" className="text-xs font-medium text-zinc-700">
                Reason (optional)
              </label>
              <textarea
                id="revoke-reason"
                value={revokeReason}
                onChange={(event) => setRevokeReason(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>

            {revokeError ? <p className="mt-3 text-sm text-red-700">{revokeError}</p> : null}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={revoking}
                onClick={() => void submitRevoke()}
                className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {revoking ? "Removing…" : "Remove payment method"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
