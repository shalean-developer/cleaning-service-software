"use client";

import type { AdminWizardCustomerBillingSnapshot } from "../adminBillingMode";

type Props = {
  snapshot: AdminWizardCustomerBillingSnapshot | null;
  loading?: boolean;
  error?: string | null;
};

export function AdminBookingWizardCustomerBillingStatus({
  snapshot,
  loading = false,
  error = null,
}: Props) {
  if (loading) {
    return (
      <p className="text-sm text-slate-500" data-testid="admin-booking-customer-billing-loading">
        Loading customer billing account…
      </p>
    );
  }

  if (error) {
    return (
      <p
        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        role="alert"
        data-testid="admin-booking-customer-billing-error"
      >
        {error}
      </p>
    );
  }

  if (!snapshot?.accountId) {
    return (
      <p
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        data-testid="admin-booking-customer-billing-disabled"
      >
        Monthly billing not enabled for this customer.
      </p>
    );
  }

  return (
    <div
      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"
      data-testid="admin-booking-customer-billing-status"
    >
      <p className="font-medium text-slate-900">Customer billing account</p>
      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Status</dt>
          <dd>{snapshot.accountStatusLabel}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Monthly account</dt>
          <dd>{snapshot.monthlyAccountEnabled ? "Enabled" : "Disabled"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Zoho customer</dt>
          <dd className="font-mono">{snapshot.zohoCustomerId ?? "Not linked"}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-slate-500">Billing email</dt>
          <dd>{snapshot.billingEmail ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Billing terms</dt>
          <dd className="mt-0.5 whitespace-pre-wrap">{snapshot.billingTerms ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}
