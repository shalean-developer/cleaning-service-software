"use client";

import { useCallback, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminDetailSection } from "@/components/dashboard/admin/AdminDetailSection";
import {
  disableCustomerMonthlyBilling,
  enableCustomerMonthlyBilling,
  linkCustomerMonthlyBillingZohoCustomer,
  updateCustomerMonthlyBillingTerms,
} from "@/features/monthly-billing/api";
import type { CustomerBillingAccountReadModel } from "@/features/monthly-billing/server/customerBillingAccountReadModel";
import { AdminCustomerGovernancePanel } from "@/components/dashboard/admin/AdminCustomerGovernancePanel";

type GovernanceContext = NonNullable<
  Awaited<ReturnType<typeof import("@/features/monthly-billing/server/loadCustomerGovernancePanelContext").loadCustomerGovernancePanelContext>>
>;

type Props = {
  billing: CustomerBillingAccountReadModel;
  setupEnabled: boolean;
  defaultBillingEmail?: string | null;
  governanceContext?: GovernanceContext | null;
};

type ModalKind = "enable" | "disable" | "terms" | "zoho" | null;

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-ZA");
}

export function AdminCustomerBillingAccountPanel({
  billing,
  setupEnabled,
  defaultBillingEmail,
  governanceContext,
}: Props) {
  const router = useRouter();
  const errorId = useId();
  const idempotencyRef = useRef(crypto.randomUUID());
  const [modal, setModal] = useState<ModalKind>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [billingEmail, setBillingEmail] = useState(
    billing.billingEmail ?? defaultBillingEmail ?? "",
  );
  const [billingTerms, setBillingTerms] = useState(billing.billingTerms ?? "Net 30 — invoice at month end");
  const [approvalReason, setApprovalReason] = useState("");
  const [reason, setReason] = useState("");
  const [zohoCustomerId, setZohoCustomerId] = useState(billing.zohoCustomerId ?? "");
  const [createZohoCustomer, setCreateZohoCustomer] = useState(false);
  const [monthEndConfirmed, setMonthEndConfirmed] = useState(false);

  const refresh = useCallback(() => {
    idempotencyRef.current = crypto.randomUUID();
    router.refresh();
  }, [router]);

  const closeModal = () => {
    setModal(null);
    setError(null);
    setApprovalReason("");
    setReason("");
    setMonthEndConfirmed(false);
    setCreateZohoCustomer(false);
  };

  const onEnable = async () => {
    if (!monthEndConfirmed) {
      setError("Confirm month-end billing approval.");
      return;
    }
    setLoading(true);
    setError(null);
    const result = await enableCustomerMonthlyBilling(billing.customerId, {
      billingEmail,
      billingTerms,
      approvalReason,
      idempotencyKey: idempotencyRef.current,
      zohoCustomerId: zohoCustomerId.trim() || undefined,
      createZohoCustomer: zohoCustomerId.trim() ? undefined : createZohoCustomer || undefined,
      monthEndBillingConfirmed: true,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    closeModal();
    refresh();
  };

  const onDisable = async () => {
    setLoading(true);
    setError(null);
    const result = await disableCustomerMonthlyBilling(billing.customerId, {
      reason,
      idempotencyKey: idempotencyRef.current,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    closeModal();
    refresh();
  };

  const onUpdateTerms = async () => {
    setLoading(true);
    setError(null);
    const result = await updateCustomerMonthlyBillingTerms(billing.customerId, {
      billingEmail,
      billingTerms,
      reason,
      idempotencyKey: idempotencyRef.current,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    closeModal();
    refresh();
  };

  const onLinkZoho = async () => {
    setLoading(true);
    setError(null);
    const result = await linkCustomerMonthlyBillingZohoCustomer(billing.customerId, {
      zohoCustomerId,
      reason,
      idempotencyKey: idempotencyRef.current,
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    closeModal();
    refresh();
  };

  const hasAccount = Boolean(billing.account);
  const isEnabled = billing.monthlyAccountEnabled;

  return (
    <div data-testid="admin-customer-billing-account-card">
      <AdminDetailSection
        title="Billing account"
        description="Monthly account billing eligibility (admin-only)."
        tone="ops"
        collapsible
      >
        {!setupEnabled ? (
          <p
            className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700"
            data-testid="monthly-billing-setup-disabled-notice"
          >
            Monthly account billing setup is disabled.
          </p>
        ) : null}

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500">Current billing mode</dt>
            <dd className="font-medium text-zinc-900">{billing.billingMode ?? "Not configured"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Monthly account</dt>
            <dd>
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isEnabled ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"
                }`}
              >
                {isEnabled ? "Enabled" : "Disabled"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500">Zoho customer id</dt>
            <dd className="font-mono text-xs text-zinc-800">{billing.zohoCustomerId ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Billing email</dt>
            <dd className="text-zinc-900">{billing.billingEmail ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-zinc-500">Billing terms</dt>
            <dd className="text-zinc-900">{billing.billingTerms ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Approved at</dt>
            <dd className="text-zinc-900">{formatDateTime(billing.approvedAt)}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Account status</dt>
            <dd className="text-zinc-900">{billing.accountStatusLabel}</dd>
          </div>
          <div>
            <dt className="text-zinc-500">Draft bookings awaiting authorization</dt>
            <dd className="text-zinc-900">
              {billing.draftMonthlyAccountBookingsAwaitingAuthorization}
            </dd>
          </div>
          {billing.currentMonthAccruedBatch ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Current month accrued batch</dt>
              <dd className="text-zinc-900" data-testid="customer-current-month-accrued-batch">
                {billing.currentMonthAccruedBatch.billingMonth} ·{" "}
                {billing.currentMonthAccruedBatch.itemCount} item
                {billing.currentMonthAccruedBatch.itemCount === 1 ? "" : "s"} ·{" "}
                {new Intl.NumberFormat("en-ZA", {
                  style: "currency",
                  currency: "ZAR",
                  maximumFractionDigits: 0,
                }).format(billing.currentMonthAccruedBatch.totalCents / 100)}{" "}
                ({billing.currentMonthAccruedBatch.status})
              </dd>
            </div>
          ) : billing.monthlyAccountEnabled ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Current month accrued batch</dt>
              <dd className="text-zinc-600" data-testid="customer-current-month-accrued-batch-empty">
                No draft batch for the current billing month yet.
              </dd>
            </div>
          ) : null}
          {billing.latestMonthlyBatch &&
          (billing.latestMonthlyBatch.status === "generated" ||
            billing.latestMonthlyBatch.status === "sent" ||
            billing.latestMonthlyBatch.status === "overdue") ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Latest generated invoice</dt>
              <dd className="text-zinc-900" data-testid="customer-latest-generated-invoice">
                {billing.latestMonthlyBatch.billingMonth} · {billing.latestMonthlyBatch.status} ·
                awaiting payment
              </dd>
            </div>
          ) : null}
          {billing.latestMonthlyBatch?.status === "paid" ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Latest monthly invoice</dt>
              <dd className="text-zinc-900" data-testid="customer-latest-paid-invoice">
                {billing.latestMonthlyBatch.billingMonth} · paid
              </dd>
            </div>
          ) : null}
          {billing.latestMonthlyBatch ? (
            <div className="sm:col-span-2">
              <dt className="text-zinc-500">Latest invoice batch</dt>
              <dd className="text-zinc-900">
                {billing.latestMonthlyBatch.billingMonth} · {billing.latestMonthlyBatch.status} ·{" "}
                {billing.latestMonthlyBatch.itemCount} items
              </dd>
            </div>
          ) : null}
        </dl>

        {billing.auditEntries.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Audit history</h3>
            <ul className="mt-2 space-y-1 text-sm text-zinc-700">
              {billing.auditEntries.slice(0, 5).map((entry) => (
                <li key={entry.id}>
                  {entry.action} · {formatDateTime(entry.createdAt)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {setupEnabled ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {!isEnabled ? (
              <button
                type="button"
                className="inline-flex min-h-9 items-center rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
                data-testid="monthly-billing-enable-button"
                onClick={() => setModal("enable")}
              >
                Enable monthly billing
              </button>
            ) : null}
            {hasAccount ? (
              <>
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                  data-testid="monthly-billing-update-terms-button"
                  onClick={() => setModal("terms")}
                >
                  Update terms
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                  data-testid="monthly-billing-link-zoho-button"
                  onClick={() => setModal("zoho")}
                >
                  Link Zoho customer
                </button>
                {isEnabled ? (
                  <button
                    type="button"
                    className="inline-flex min-h-9 items-center rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50"
                    data-testid="monthly-billing-disable-button"
                    onClick={() => setModal("disable")}
                  >
                    Disable monthly billing
                  </button>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        {modal ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4">
            {modal === "enable" ? (
              <div className="space-y-3 text-sm">
                <p className="font-medium text-zinc-900">Enable monthly billing</p>
                <label className="block">
                  <span className="text-zinc-600">Billing email</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-zinc-600">Billing terms</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                    value={billingTerms}
                    onChange={(e) => setBillingTerms(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-zinc-600">Approval reason</span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                    rows={2}
                    value={approvalReason}
                    onChange={(e) => setApprovalReason(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-zinc-600">Zoho customer id (optional)</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs"
                    value={zohoCustomerId}
                    onChange={(e) => setZohoCustomerId(e.target.value)}
                  />
                </label>
                {!zohoCustomerId.trim() ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={createZohoCustomer}
                      onChange={(e) => setCreateZohoCustomer(e.target.checked)}
                    />
                    <span>Create or find Zoho customer by email</span>
                  </label>
                ) : null}
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={monthEndConfirmed}
                    onChange={(e) => setMonthEndConfirmed(e.target.checked)}
                  />
                  <span>I confirm this customer is approved for month-end billing.</span>
                </label>
              </div>
            ) : null}

            {modal === "disable" ? (
              <div className="space-y-3 text-sm">
                <p className="font-medium text-zinc-900">Disable monthly billing</p>
                <p className="text-zinc-600">
                  Existing monthly invoice batches are not deleted.
                </p>
                <label className="block">
                  <span className="text-zinc-600">Reason</span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              </div>
            ) : null}

            {modal === "terms" ? (
              <div className="space-y-3 text-sm">
                <p className="font-medium text-zinc-900">Update billing terms</p>
                <label className="block">
                  <span className="text-zinc-600">Billing email</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-zinc-600">Billing terms</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                    value={billingTerms}
                    onChange={(e) => setBillingTerms(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-zinc-600">Reason</span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              </div>
            ) : null}

            {modal === "zoho" ? (
              <div className="space-y-3 text-sm">
                <p className="font-medium text-zinc-900">Link Zoho customer</p>
                <label className="block">
                  <span className="text-zinc-600">Zoho customer id</span>
                  <input
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs"
                    value={zohoCustomerId}
                    onChange={(e) => setZohoCustomerId(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-zinc-600">Reason</span>
                  <textarea
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2"
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
              </div>
            ) : null}

            {error ? (
              <p id={errorId} className="mt-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                className="inline-flex min-h-9 items-center rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
                onClick={() => {
                  if (modal === "enable") void onEnable();
                  if (modal === "disable") void onDisable();
                  if (modal === "terms") void onUpdateTerms();
                  if (modal === "zoho") void onLinkZoho();
                }}
              >
                {loading ? "Saving…" : "Confirm"}
              </button>
              <button
                type="button"
                className="inline-flex min-h-9 items-center rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
                onClick={closeModal}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </AdminDetailSection>

      {governanceContext ? (
        <AdminCustomerGovernancePanel
          customerId={billing.customerId}
          account={governanceContext.account}
          exposure={governanceContext.exposure}
          riskScore={governanceContext.riskScore}
          riskLevel={governanceContext.riskLevel}
          recommendation={governanceContext.recommendation}
          timeline={governanceContext.timeline}
        />
      ) : null}
    </div>
  );
}
