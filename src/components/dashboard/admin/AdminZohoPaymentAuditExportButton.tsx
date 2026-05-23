"use client";

import { useState } from "react";

export function AdminZohoPaymentAuditExportButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadReport(format: "csv" | "json") {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/zoho-invoice-payments/audit-export?format=${format}`,
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        setError(body?.message ?? "Could not download audit report.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download =
        format === "csv"
          ? `zoho-payment-audit-${new Date().toISOString().slice(0, 10)}.csv`
          : `zoho-payment-audit-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not download audit report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-zinc-900">Payment audit export</h2>
      <p className="mt-1 text-xs text-zinc-600">
        Safe export of invoice payments, saved-card captures, admin charges, and revocations. No
        authorization codes or raw Paystack metadata.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void downloadReport("csv")}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          Download payment audit report (CSV)
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void downloadReport("json")}
          className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-800 disabled:opacity-50"
        >
          JSON
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
