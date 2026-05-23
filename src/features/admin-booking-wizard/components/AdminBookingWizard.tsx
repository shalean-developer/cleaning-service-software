"use client";

import { useCallback, useMemo, useState } from "react";
import {
  WIZARD_SHELL_WIDE_WITH_SIDEBAR_CLASS,
  WIZARD_STEP_CARD_MIN_HEIGHT_CLASS,
} from "@/features/booking-wizard/wizardLayout";
import { WIZARD_BTN_PRIMARY, WIZARD_BTN_SECONDARY } from "@/features/booking-wizard/wizardTheme";
import { resolveAdminPaymentSummaryLabel } from "../adminActionGuidance";
import { buildAdminBookingSummaryLabels } from "../adminBookingSummaryDisplay";
import {
  EMPTY_ADMIN_BOOKING_FLOW,
  resolveAdminBookingFlowPhase,
  resolveAdminBookingFlowPhaseLabel,
} from "../adminBookingFlowState";
import {
  EMPTY_ADMIN_BOOKING_WIZARD_FORM,
  type AdminBookingWizardFormState,
} from "../draftFormState";
import { adminWizardNextStep, adminWizardPreviousStep } from "../navigation";
import { validateAdminWizardStep } from "../adminStepValidation";
import type { AdminBookingWizardStep, AdminBookingWizardSummary } from "../types";
import { useAdminBookingFlowRefresh } from "../useAdminBookingFlowRefresh";
import { useAdminBookingQuote } from "../useAdminBookingQuote";
import { useAdminCustomerPrefill } from "../useAdminCustomerPrefill";
import { AdminBookingWizardDesignModeBanner } from "./AdminBookingWizardDesignModeBanner";
import { AdminBookingWizardStepper } from "./AdminBookingWizardStepper";
import {
  AdminBookingWizardSummaryMobileSheet,
  AdminBookingWizardSummarySidebar,
} from "./AdminBookingWizardSummarySidebar";
import { AdminBookingWizardStepPanel } from "./steps/AdminBookingWizardStepPanels";

type Props = {
  featureEnabled: boolean;
  paymentLinksEnabled: boolean;
  offlinePaymentsEnabled: boolean;
  initialCustomerId?: string | null;
  initialCustomerLabel?: string | null;
};

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
  paymentLinksEnabled,
  offlinePaymentsEnabled,
  initialCustomerId,
  initialCustomerLabel,
}: Props) {
  const [step, setStep] = useState<AdminBookingWizardStep>("customer");
  const [form, setForm] = useState<AdminBookingWizardFormState>(() =>
    buildInitialForm(initialCustomerId, initialCustomerLabel),
  );
  const [flow, setFlow] = useState(EMPTY_ADMIN_BOOKING_FLOW);
  const { quote } = useAdminBookingQuote(form);

  const onFormChange = useCallback((patch: Partial<AdminBookingWizardFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const { loading: customerPrefillLoading, error: customerPrefillError } = useAdminCustomerPrefill(
    initialCustomerId,
    onFormChange,
  );

  const { refresh: refreshFlow } = useAdminBookingFlowRefresh(flow, setFlow, {
    pollWhileAwaitingPayment: step === "confirmation" || step === "payment",
  });

  const stepValidation = useMemo(() => validateAdminWizardStep(step, form), [step, form]);

  const summary = useMemo((): AdminBookingWizardSummary => {
    const labels = buildAdminBookingSummaryLabels(form, quote);
    const phase = resolveAdminBookingFlowPhase(flow);
    return {
      ...labels,
      paymentLabel: resolveAdminPaymentSummaryLabel(flow),
      lifecyclePreview: resolveAdminBookingFlowPhaseLabel(phase),
    };
  }, [form, quote, flow]);

  const isFirstStep = step === "customer";
  const isLastStep = step === "confirmation";
  const nextStep = adminWizardNextStep(step);
  const prevStep = adminWizardPreviousStep(step);

  const continueLabel = useMemo(() => {
    if (step === "review") return "Continue to confirmation";
    if (isLastStep) return "Done";
    return "Continue";
  }, [isLastStep, step]);

  const canContinue = !isLastStep && Boolean(nextStep) && stepValidation.valid;

  return (
    <div className={WIZARD_SHELL_WIDE_WITH_SIDEBAR_CLASS} data-testid="admin-booking-wizard">
      <AdminBookingWizardDesignModeBanner featureEnabled={featureEnabled} />

      {customerPrefillError ? (
        <p
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
          data-testid="admin-booking-customer-prefill-error"
        >
          {customerPrefillError}
        </p>
      ) : null}

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
              paymentLinksEnabled={paymentLinksEnabled}
              offlinePaymentsEnabled={offlinePaymentsEnabled}
              form={form}
              flow={flow}
              customerPrefillLoading={customerPrefillLoading}
              customerPrefillError={customerPrefillError}
              onFormChange={onFormChange}
              onFlowChange={setFlow}
              onFlowRefresh={refreshFlow}
            />
          </div>

          {stepValidation.message ? (
            <p
              className="mt-2 text-sm text-red-700"
              role="alert"
              data-testid="admin-booking-step-validation"
            >
              {stepValidation.message}
            </p>
          ) : null}

          <div
            className={`mt-4 flex w-full min-w-0 gap-3 ${step === "confirmation" ? "md:pb-0 pb-24" : ""}`}
          >
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
                disabled={!canContinue}
                onClick={() => setStep(nextStep)}
                className={`min-h-11 flex-1 px-4 py-3 text-sm font-medium ${WIZARD_BTN_PRIMARY}`}
                data-testid="admin-booking-wizard-continue"
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
