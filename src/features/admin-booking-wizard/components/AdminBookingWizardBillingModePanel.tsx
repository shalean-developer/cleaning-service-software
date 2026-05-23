"use client";

import { WIZARD_TEXT_MUTED } from "@/features/booking-wizard/wizardTheme";
import {
  ADMIN_WIZARD_BILLING_MODES,
  formatAdminWizardBillingModeDescription,
  formatAdminWizardBillingModeLabel,
  isCustomerEligibleForMonthlyAccountWizard,
  resolveMonthlyAccountDisabledReason,
  type AdminWizardBillingMode,
} from "../adminBillingMode";
import type { AdminBookingWizardFormState } from "../draftFormState";

type Props = {
  form: AdminBookingWizardFormState;
  monthlyBillingEnabled: boolean;
  onFormChange: (patch: Partial<AdminBookingWizardFormState>) => void;
};

export function AdminBookingWizardBillingModePanel({
  form,
  monthlyBillingEnabled,
  onFormChange,
}: Props) {
  const monthlyEligible = isCustomerEligibleForMonthlyAccountWizard(
    form.customerBillingAccount,
    monthlyBillingEnabled,
  );
  const monthlyDisabledReason = resolveMonthlyAccountDisabledReason(
    form.customerBillingAccount,
    monthlyBillingEnabled,
  );

  return (
    <div className="space-y-4" data-testid="admin-booking-billing-mode-panel">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Billing mode
        </h3>
        <p className={`mt-1 text-xs ${WIZARD_TEXT_MUTED}`}>
          Choose how this booking will be paid. Monthly account stores metadata only in this phase.
        </p>
        <div className="mt-3 space-y-2">
          {ADMIN_WIZARD_BILLING_MODES.map((mode) => {
            const disabled = mode === "monthly_account" && !monthlyEligible;
            const inputId = `admin-booking-billing-mode-${mode}`;

            return (
              <label
                key={mode}
                htmlFor={inputId}
                className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-3 ${
                  form.billingMode === mode
                    ? "border-sky-300 bg-sky-50"
                    : "border-slate-200 bg-white"
                } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                data-testid={`admin-booking-billing-mode-option-${mode}`}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="admin-booking-billing-mode"
                  value={mode}
                  checked={form.billingMode === mode}
                  disabled={disabled}
                  onChange={() => onFormChange({ billingMode: mode as AdminWizardBillingMode })}
                  className="mt-1"
                  data-testid={`admin-booking-billing-mode-input-${mode}`}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">
                    {formatAdminWizardBillingModeLabel(mode)}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-600">
                    {formatAdminWizardBillingModeDescription(mode)}
                  </span>
                  {mode === "monthly_account" && disabled && monthlyDisabledReason ? (
                    <span className="mt-1 block text-xs text-amber-800">
                      {monthlyDisabledReason}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </section>

      {form.billingModeResetMessage ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
          role="status"
          data-testid="admin-booking-billing-mode-reset-message"
        >
          {form.billingModeResetMessage}
        </p>
      ) : null}

      {form.billingMode === "monthly_account" ? (
        <section
          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950"
          data-testid="admin-booking-monthly-account-warning"
        >
          <p className="font-medium">Monthly account — metadata only</p>
          <p className="mt-1 text-xs">
            Monthly account does not confirm or assign bookings until service authorization is added
            in a later phase. Only save draft is available.
          </p>
          {form.customerBillingAccount?.billingTerms ? (
            <div className="mt-3 border-t border-amber-200/80 pt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-900">
                Billing terms
              </p>
              <p className="mt-1 whitespace-pre-wrap text-xs">
                {form.customerBillingAccount.billingTerms}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
