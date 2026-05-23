"use client";

import { useCallback, useMemo, useState } from "react";
import {
  WIZARD_SHELL_WIDE_WITH_SIDEBAR_CLASS,
  WIZARD_STEP_CARD_MIN_HEIGHT_CLASS,
} from "@/features/booking-wizard/wizardLayout";
import { WIZARD_BTN_PRIMARY, WIZARD_BTN_SECONDARY } from "@/features/booking-wizard/wizardTheme";
import {
  EMPTY_ADMIN_BOOKING_WIZARD_FORM,
  type AdminBookingWizardFormState,
} from "../draftFormState";
import { adminWizardNextStep, adminWizardPreviousStep } from "../navigation";
import type { AdminBookingWizardStep, AdminBookingWizardSummary } from "../types";
import { AdminBookingWizardDesignModeBanner } from "./AdminBookingWizardDesignModeBanner";
import { AdminBookingWizardStepper } from "./AdminBookingWizardStepper";
import {
  AdminBookingWizardSummaryMobileSheet,
  AdminBookingWizardSummarySidebar,
} from "./AdminBookingWizardSummarySidebar";
import { AdminBookingWizardStepPanel } from "./steps/AdminBookingWizardStepPanels";

type Props = {
  featureEnabled: boolean;
  initialCustomerId?: string | null;
  initialCustomerLabel?: string | null;
};

function buildSummary(form: AdminBookingWizardFormState): AdminBookingWizardSummary {
  return {
    customerLabel: form.selectedCustomer?.label ?? "Not selected",
    serviceLabel: form.serviceSlug || "Not selected",
    scheduleLabel:
      form.date && form.time ? `${form.date} ${form.time}` : "Not scheduled",
    addressLabel:
      form.addressLine1 && form.suburb
        ? `${form.addressLine1}, ${form.suburb}`
        : "Not entered",
    totalLabel: "Calculated on save",
    paymentLabel: "None (draft only)",
    lifecyclePreview: "draft (stops here — Phase 2)",
  };
}

function buildInitialForm(
  initialCustomerId?: string | null,
  initialCustomerLabel?: string | null,
): AdminBookingWizardFormState {
  const customerId = initialCustomerId?.trim() ?? "";
  if (!customerId) return EMPTY_ADMIN_BOOKING_WIZARD_FORM;

  const label = initialCustomerLabel?.trim() || customerId.slice(0, 8);
  return {
    ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
    customerId,
    selectedCustomer: {
      customerId,
      label,
      email: null,
      phone: null,
    },
  };
}

export function AdminBookingWizard({
  featureEnabled,
  initialCustomerId,
  initialCustomerLabel,
}: Props) {
  const [step, setStep] = useState<AdminBookingWizardStep>("customer");
  const [form, setForm] = useState<AdminBookingWizardFormState>(() =>
    buildInitialForm(initialCustomerId, initialCustomerLabel),
  );
  const summary = useMemo(() => buildSummary(form), [form]);

  const onFormChange = useCallback((patch: Partial<AdminBookingWizardFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const isFirstStep = step === "customer";
  const isLastStep = step === "confirmation";
  const nextStep = adminWizardNextStep(step);
  const prevStep = adminWizardPreviousStep(step);

  const continueLabel = useMemo(() => {
    if (step === "review") return "Continue to confirmation";
    if (isLastStep) return "Done";
    return "Continue";
  }, [isLastStep, step]);

  return (
    <div className={WIZARD_SHELL_WIDE_WITH_SIDEBAR_CLASS} data-testid="admin-booking-wizard">
      <AdminBookingWizardDesignModeBanner featureEnabled={featureEnabled} />

      <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <AdminBookingWizardSummaryMobileSheet summary={summary} />
          <AdminBookingWizardStepper current={step} />

          <div
            className={`w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5 ${WIZARD_STEP_CARD_MIN_HEIGHT_CLASS}`}
          >
            <AdminBookingWizardStepPanel
              step={step}
              featureEnabled={featureEnabled}
              form={form}
              onFormChange={onFormChange}
            />
          </div>

          <div className="mt-4 flex w-full min-w-0 gap-3">
            {!isFirstStep && prevStep ? (
              <button
                type="button"
                onClick={() => setStep(prevStep)}
                className={`min-h-11 flex-1 px-4 py-3 text-sm font-medium ${WIZARD_BTN_SECONDARY}`}
              >
                Back
              </button>
            ) : (
              <div className="flex-1" aria-hidden />
            )}
            {!isLastStep && nextStep ? (
              <button
                type="button"
                onClick={() => setStep(nextStep)}
                className={`min-h-11 flex-1 px-4 py-3 text-sm font-medium ${WIZARD_BTN_PRIMARY}`}
              >
                {continueLabel}
              </button>
            ) : (
              <button
                type="button"
                disabled
                className={`min-h-11 flex-1 px-4 py-3 text-sm font-medium ${WIZARD_BTN_PRIMARY}`}
                data-testid="admin-booking-wizard-done"
              >
                {continueLabel}
              </button>
            )}
          </div>
        </div>

        <AdminBookingWizardSummarySidebar summary={summary} />
      </div>
    </div>
  );
}
