"use client";

import { useMemo, useState } from "react";
import { isAdminAssistedBookingEnabled } from "@/lib/app/adminAssistedBookingFlag";
import {
  WIZARD_SHELL_WIDE_WITH_SIDEBAR_CLASS,
  WIZARD_STEP_CARD_MIN_HEIGHT_CLASS,
} from "@/features/booking-wizard/wizardLayout";
import { WIZARD_BTN_PRIMARY, WIZARD_BTN_SECONDARY } from "@/features/booking-wizard/wizardTheme";
import { adminWizardNextStep, adminWizardPreviousStep } from "../navigation";
import type { AdminBookingWizardStep, AdminBookingWizardSummary } from "../types";
import { AdminBookingWizardDesignModeBanner } from "./AdminBookingWizardDesignModeBanner";
import { AdminBookingWizardStepper } from "./AdminBookingWizardStepper";
import {
  AdminBookingWizardSummaryMobileSheet,
  AdminBookingWizardSummarySidebar,
} from "./AdminBookingWizardSummarySidebar";
import { AdminBookingWizardStepPanel } from "./steps/AdminBookingWizardStepPanels";

const DEFAULT_SUMMARY: AdminBookingWizardSummary = {
  customerLabel: "Not selected",
  serviceLabel: "Not selected",
  scheduleLabel: "Not scheduled",
  addressLabel: "Not entered",
  totalLabel: "—",
  paymentLabel: "Not selected",
  lifecyclePreview: "draft → pending_payment → confirmed → …",
};

export function AdminBookingWizard() {
  const featureEnabled = isAdminAssistedBookingEnabled();
  const [step, setStep] = useState<AdminBookingWizardStep>("customer");
  const summary = DEFAULT_SUMMARY;

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
            <AdminBookingWizardStepPanel step={step} />
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
