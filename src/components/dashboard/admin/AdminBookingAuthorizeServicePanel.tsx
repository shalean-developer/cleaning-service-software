"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  authorizeMonthlyAccountService,
  fetchMonthlyAccountAuthorizationContext,
} from "@/features/monthly-billing/api";
import { WIZARD_BTN_PRIMARY } from "@/features/booking-wizard/wizardTheme";

type AuthorizationContext = {
  governanceEnabled: boolean;
  account: {
    governanceState: string;
    creditLimitCents: number | null;
    manualOverrideUntil: string | null;
  } | null;
  exposure: {
    outstandingBalanceCents: number;
    totalExposureCents: number;
    exposurePercent: number | null;
    exposureBand: string;
    overdueInvoiceCount: number;
    disputedInvoiceCount: number;
  } | null;
  overrideActive: boolean;
  requiresElevatedConfirmation: boolean;
  riskScore: number | null;
  riskLevel: string | null;
  warnings: string[];
};

type Props = {
  bookingId: string;
  customerId: string;
  monthlyAccountId: string;
  serviceAuthorizationEnabled: boolean;
  accountEnabled: boolean;
  alreadyAuthorized?: boolean;
  onSuccess?: () => void;
};

function formatZar(cents: number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function GovernanceSnapshotCard({ context }: { context: AuthorizationContext }) {
  const { exposure, account } = context;
  if (!exposure || !account) return null;

  return (
    <div
      className="space-y-2 rounded-lg border border-slate-200 bg-white/80 p-3 text-xs text-slate-800"
      data-testid="admin-booking-authorize-service-governance-warnings"
    >
      <p className="font-medium text-slate-900">Credit governance snapshot</p>
      <ul className="space-y-1">
        <li>Outstanding balance: {formatZar(exposure.outstandingBalanceCents)}</li>
        <li>Total exposure: {formatZar(exposure.totalExposureCents)}</li>
        <li>
          Credit limit:{" "}
          {account.creditLimitCents != null ? formatZar(account.creditLimitCents) : "Not set"}
        </li>
        <li>
          Exposure: {exposure.exposurePercent != null ? `${exposure.exposurePercent}%` : "—"} (
          {exposure.exposureBand})
        </li>
        <li>Governance state: {account.governanceState}</li>
        <li>Overdue invoices: {exposure.overdueInvoiceCount}</li>
        <li>Active disputes: {exposure.disputedInvoiceCount}</li>
        {context.riskScore != null ? (
          <li>
            Risk score: {context.riskScore} ({context.riskLevel})
          </li>
        ) : null}
        {context.overrideActive && account.manualOverrideUntil ? (
          <li className="text-amber-800">
            Temporary override active until {account.manualOverrideUntil}.
          </li>
        ) : null}
      </ul>
      {context.warnings.length > 0 ? (
        <ul className="space-y-1 text-amber-900" data-testid="admin-booking-authorize-service-warning-list">
          {context.warnings.map((warning) => (
            <li key={warning}>• {warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function AdminBookingAuthorizeServicePanel({
  bookingId,
  customerId,
  monthlyAccountId,
  serviceAuthorizationEnabled,
  accountEnabled,
  alreadyAuthorized = false,
  onSuccess,
}: Props) {
  const errorId = useId();
  const idempotencyRef = useRef(crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [elevatedConfirmed, setElevatedConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [authContext, setAuthContext] = useState<AuthorizationContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchMonthlyAccountAuthorizationContext(customerId).then((result) => {
      if (cancelled || !result.ok) return;
      setAuthContext(result.context as AuthorizationContext);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const isSuspended = authContext?.account?.governanceState === "suspended";
  const requiresElevated =
    authContext?.governanceEnabled && authContext.requiresElevatedConfirmation;

  const canSubmit =
    serviceAuthorizationEnabled &&
    accountEnabled &&
    !alreadyAuthorized &&
    !success &&
    !loading &&
    !isSuspended &&
    reason.trim().length > 0 &&
    confirmed &&
    (!requiresElevated || elevatedConfirmed);

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const result = await authorizeMonthlyAccountService(bookingId, {
        customerId,
        monthlyAccountId,
        reason: reason.trim(),
        idempotencyKey: idempotencyRef.current,
        confirmMonthlyAccount: true,
        ...(requiresElevated ? { confirmElevatedExposure: true as const } : {}),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSuccess(true);
      onSuccess?.();
    } catch {
      setError("Could not authorize service. Try again.");
    } finally {
      setLoading(false);
    }
  }, [
    bookingId,
    canSubmit,
    customerId,
    monthlyAccountId,
    onSuccess,
    reason,
    requiresElevated,
  ]);

  if (alreadyAuthorized || success) {
    return <AuthorizeServiceSuccessPanel />;
  }

  if (!serviceAuthorizationEnabled) {
    return (
      <p className="text-xs text-slate-500" data-testid="admin-booking-authorize-service-disabled">
        Monthly service authorization is disabled in this environment.
      </p>
    );
  }

  return (
    <section
      className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3"
      data-testid="admin-booking-authorize-service-panel"
    >
      <AuthorizeServiceHeader />

      {authContext?.governanceEnabled && authContext.exposure && authContext.account ? (
        <GovernanceSnapshotCard context={authContext} />
      ) : null}

      <AuthorizeServiceReasonField reason={reason} setReason={setReason} />
      <AuthorizeServiceConfirmCheckbox confirmed={confirmed} setConfirmed={setConfirmed} />

      {requiresElevated ? (
        <label className="flex items-start gap-2 text-sm text-red-900">
          <input
            type="checkbox"
            checked={elevatedConfirmed}
            onChange={(e) => setElevatedConfirmed(e.target.checked)}
            className="mt-1"
            data-testid="admin-booking-authorize-service-elevated-confirm"
          />
          <span>
            I acknowledge elevated or exceeded credit exposure and approve authorization anyway.
          </span>
        </label>
      ) : null}

      {!accountEnabled ? (
        <p className="text-xs text-red-700">Monthly account billing is not enabled for this customer.</p>
      ) : null}

      {isSuspended ? (
        <p className="text-xs text-red-700" data-testid="admin-booking-authorize-service-suspended">
          Account is suspended. Remove suspension before authorizing new monthly services.
        </p>
      ) : null}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void onSubmit()}
        className={`min-h-11 w-full rounded-xl px-4 text-sm font-medium ${WIZARD_BTN_PRIMARY}`}
        data-testid="admin-booking-authorize-service-submit"
      >
        {loading ? "Authorizing…" : "Authorize service"}
      </button>

      {error ? (
        <p id={errorId} className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function AuthorizeServiceSuccessPanel() {
  return (
    <div
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900"
      data-testid="admin-booking-authorize-service-success"
    >
      <p className="font-medium">Service authorized for monthly account</p>
      <p className="mt-1 text-xs">Assignment may proceed. No payment was recorded.</p>
    </div>
  );
}

function AuthorizeServiceHeader() {
  return (
    <div>
      <p className="text-sm font-medium text-amber-950">Authorize service</p>
      <p className="mt-1 text-xs text-amber-900">
        This does not record payment. It authorizes service delivery and assignment before
        month-end invoicing.
      </p>
    </div>
  );
}

function AuthorizeServiceReasonField({
  reason,
  setReason,
}: {
  reason: string;
  setReason: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-800">Reason</span>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={2}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        data-testid="admin-booking-authorize-service-reason"
      />
    </label>
  );
}

function AuthorizeServiceConfirmCheckbox({
  confirmed,
  setConfirmed,
}: {
  confirmed: boolean;
  setConfirmed: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-800">
      <input
        type="checkbox"
        checked={confirmed}
        onChange={(e) => setConfirmed(e.target.checked)}
        className="mt-1"
        data-testid="admin-booking-authorize-service-confirm"
      />
      <span>I confirm this customer is approved for month-end billing.</span>
    </label>
  );
}
