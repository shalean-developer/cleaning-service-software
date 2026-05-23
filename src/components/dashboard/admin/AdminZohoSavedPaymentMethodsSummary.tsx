import type { AdminZohoSavedPaymentMethodsSummary } from "@/features/zoho-invoice-payments/server/loadZohoInvoicePaymentMethodAdminSummary";

type Props = {
  summary: AdminZohoSavedPaymentMethodsSummary;
};

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

export function AdminZohoSavedPaymentMethodsSummary({ summary }: Props) {
  return (
    <section className="rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="border-b border-zinc-100 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-semibold text-zinc-900">Saved payment methods</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Recent customer-consented Paystack authorizations. Use payment method management below to
          search by email or revoke methods.
        </p>
      </div>

      <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Active saved methods</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">{summary.activeCount}</p>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Latest consent</p>
          <p className="mt-1 text-sm font-semibold text-zinc-900">
            {formatTimestamp(summary.latestConsentAt)}
          </p>
        </div>
      </div>

      {summary.methods.length === 0 ? (
        <p className="px-4 pb-6 text-sm text-zinc-600 sm:px-5">No saved payment methods yet.</p>
      ) : (
        <div className="overflow-x-auto px-4 pb-4 sm:px-5">
          <table className="min-w-full divide-y divide-zinc-100 text-sm">
            <thead className="bg-zinc-50/80 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Card</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Consented</th>
                <th className="px-3 py-2">Source invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {summary.methods.map((method) => (
                <tr key={method.id} className="text-zinc-800">
                  <td className="px-3 py-2">{method.maskedCustomerEmail}</td>
                  <td className="px-3 py-2">
                    {method.maskedCardDisplay}
                    {method.isDefault ? (
                      <span className="ml-2 text-xs text-zinc-500">Default</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 capitalize">{method.status}</td>
                  <td className="px-3 py-2 text-xs">{formatTimestamp(method.consentedAt)}</td>
                  <td className="px-3 py-2">{method.sourceInvoiceNumber ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
