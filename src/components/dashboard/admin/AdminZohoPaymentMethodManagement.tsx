"use client";

import { useCallback, useState } from "react";
import { ADMIN_REVOKE_CONFIRM_PHRASE } from "@/features/zoho-invoice-payments/adminRevokeConstants";

type AdminMethod = {
  id: string;
  card_type: string | null;
  bank: string | null;
  last4: string | null;
  exp_month: string | null;
  exp_year: string | null;
  reusable: boolean;
  is_default: boolean;
  consented_at: string;
  revoked_at: string | null;
  source_invoice_number: string | null;
  last_used_at: string | null;
  last_used_invoice_number: string | null;
  maskedCustomerEmail?: string;
  maskedCardDisplay?: string;
  status?: "active" | "revoked";
};

function formatCard(method: AdminMethod): string {
  if (method.maskedCardDisplay) return method.maskedCardDisplay;
  const brand = method.card_type ?? method.bank ?? "Card";
  return method.last4 ? `${brand} ending ${method.last4}` : brand;
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

export function AdminZohoPaymentMethodManagement() {
  const [customerEmail, setCustomerEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "revoked" | "all">("active");
  const [methods, setMethods] = useState<AdminMethod[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AdminMethod | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [revoking, setRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const searchMethods = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMethods([]);
    try {
      const params = new URLSearchParams({ status: statusFilter });
      if (customerEmail.trim()) {
        params.set("customerEmail", customerEmail.trim());
      }
      const response = await fetch(
        `/api/admin/zoho-invoice-payments/payment-methods?${params.toString()}`,
      );
      const body = (await response.json()) as {
        ok: boolean;
        methods?: AdminMethod[];
        message?: string;
      };
      if (!response.ok || !body.ok) {
        setError(body.message ?? "Could not load payment methods.");
        return;
      }
      setMethods(body.methods ?? []);
    } catch {
      setError("Could not load payment methods.");
    } finally {
      setLoading(false);
    }
  }, [customerEmail, statusFilter]);

  const submitRevoke = useCallback(async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    setRevokeError(null);
    try {
      const response = await fetch(
        `/api/admin/zoho-invoice-payments/payment-methods/${revokeTarget.id}/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: revokeReason.trim(),
            confirmPhrase: confirmPhrase.trim(),
          }),
        },
      );
      const body = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !body.ok) {
        setRevokeError(body.message ?? "Could not revoke payment method.");
        return;
      }
      setRevokeTarget(null);
      setRevokeReason("");
      setConfirmPhrase("");
      await searchMethods();
    } catch {
      setRevokeError("Could not revoke payment method.");
    } finally {
      setRevoking(false);
    }
  }, [confirmPhrase, revokeReason, revokeTarget, searchMethods]);

  const activeCount = methods.filter((method) => !method.revoked_at).length;

  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-zinc-100 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-semibold text-zinc-900">Payment method management</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Search saved methods by customer email for support or compliance. Revoking removes
          Shalean&apos;s ability to charge the saved authorization — it does not refund or cancel
          any existing invoice.
        </p>
      </div>

      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="pm-search-email" className="text-xs font-medium text-zinc-700">
              Customer email
            </label>
            <input
              id="pm-search-email"
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
              placeholder="customer@example.com"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="pm-status-filter" className="text-xs font-medium text-zinc-700">
              Status
            </label>
            <select
              id="pm-status-filter"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "active" | "revoked" | "all")
              }
              className="mt-1 block rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="revoked">Revoked</option>
              <option value="all">All</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void searchMethods()}
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Searching…" : "Search methods"}
            </button>
          </div>
        </div>

        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {methods.length > 0 && customerEmail.trim() && activeCount === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
            This customer has no active saved methods. Invoice charges (Phase 8) require an active
            reusable method.
          </p>
        ) : null}

        {methods.length === 0 && !loading && !error ? (
          <p className="text-sm text-zinc-600">
            {customerEmail.trim()
              ? "No payment methods match this search."
              : "Enter a customer email or search recent active methods."}
          </p>
        ) : null}

        {methods.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-100 text-sm">
              <thead className="bg-zinc-50/80 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                <tr>
                  {methods[0]?.maskedCustomerEmail ? (
                    <th className="px-3 py-2">Customer</th>
                  ) : null}
                  <th className="px-3 py-2">Card</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Consented</th>
                  <th className="px-3 py-2">Last used</th>
                  <th className="px-3 py-2">Source invoice</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {methods.map((method) => {
                  const isRevoked = Boolean(method.revoked_at);
                  return (
                    <tr key={method.id} className="text-zinc-800">
                      {method.maskedCustomerEmail ? (
                        <td className="px-3 py-2">{method.maskedCustomerEmail}</td>
                      ) : null}
                      <td className="px-3 py-2">
                        {formatCard(method)}
                        {method.is_default && !isRevoked ? (
                          <span className="ml-2 text-xs text-zinc-500">Default</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 capitalize">
                        {method.status ?? (isRevoked ? "revoked" : "active")}
                      </td>
                      <td className="px-3 py-2 text-xs">{formatTimestamp(method.consented_at)}</td>
                      <td className="px-3 py-2 text-xs">
                        {method.last_used_invoice_number
                          ? `${method.last_used_invoice_number}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{method.source_invoice_number ?? "—"}</td>
                      <td className="px-3 py-2">
                        {!isRevoked ? (
                          <button
                            type="button"
                            onClick={() => {
                              setRevokeTarget(method);
                              setRevokeReason("");
                              setConfirmPhrase("");
                              setRevokeError(null);
                            }}
                            className="text-xs font-semibold text-red-700"
                          >
                            Revoke
                          </button>
                        ) : (
                          <span className="text-xs text-zinc-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {revokeTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-revoke-title"
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
          >
            <h3 id="admin-revoke-title" className="text-sm font-semibold text-zinc-900">
              Revoke saved payment method
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-amber-800">
              This only removes Shalean&apos;s ability to charge this saved authorization. It does
              not refund or cancel any existing invoice.
            </p>
            <p className="mt-2 text-sm font-medium text-zinc-900">{formatCard(revokeTarget)}</p>

            <div className="mt-4">
              <label htmlFor="admin-revoke-reason" className="text-xs font-medium text-zinc-700">
                Reason (required)
              </label>
              <textarea
                id="admin-revoke-reason"
                value={revokeReason}
                onChange={(event) => setRevokeReason(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-3">
              <label htmlFor="admin-revoke-confirm" className="text-xs font-medium text-zinc-700">
                Type {ADMIN_REVOKE_CONFIRM_PHRASE} to confirm
              </label>
              <input
                id="admin-revoke-confirm"
                type="text"
                value={confirmPhrase}
                onChange={(event) => setConfirmPhrase(event.target.value)}
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
                disabled={
                  revoking ||
                  revokeReason.trim().length < 10 ||
                  confirmPhrase.trim() !== ADMIN_REVOKE_CONFIRM_PHRASE
                }
                onClick={() => void submitRevoke()}
                className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {revoking ? "Revoking…" : "Revoke method"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
