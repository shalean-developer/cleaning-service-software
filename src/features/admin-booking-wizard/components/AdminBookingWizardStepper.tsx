import { ADMIN_BOOKING_WIZARD_STEP_LABELS } from "../constants";
import { adminWizardStepIndex } from "../navigation";
import { ADMIN_BOOKING_WIZARD_STEPS, type AdminBookingWizardStep } from "../types";
import {
  WIZARD_PROGRESS_ACTIVE,
  WIZARD_PROGRESS_DONE,
  WIZARD_PROGRESS_PENDING,
  WIZARD_STEPPER_ACTIVE,
  WIZARD_STEPPER_DONE,
  WIZARD_STEPPER_PENDING,
  WIZARD_TEXT_MUTED,
  WIZARD_TEXT_PRIMARY,
} from "@/features/booking-wizard/wizardTheme";

type Props = {
  current: AdminBookingWizardStep;
};

export function AdminBookingWizardStepper({ current }: Props) {
  const currentIdx = adminWizardStepIndex(current);
  const currentLabel = ADMIN_BOOKING_WIZARD_STEP_LABELS[current] ?? current;
  const stepNumber = currentIdx + 1;
  const totalSteps = ADMIN_BOOKING_WIZARD_STEPS.length;

  return (
    <nav aria-label="Admin booking progress" className="mb-2.5 md:mb-6">
      <div className="md:hidden">
        <p className={`text-xs font-medium ${WIZARD_TEXT_MUTED}`}>
          Step {stepNumber} of {totalSteps}
        </p>
        <p className={`mt-0.5 text-sm font-semibold ${WIZARD_TEXT_PRIMARY}`} aria-current="step">
          {currentLabel}
        </p>
        <ol className="mt-2 flex gap-1" aria-hidden>
          {ADMIN_BOOKING_WIZARD_STEPS.map((step, idx) => {
            const done = idx < currentIdx;
            const active = step === current;
            return (
              <li
                key={step}
                className={`h-1 flex-1 rounded-full ${
                  active
                    ? WIZARD_PROGRESS_ACTIVE
                    : done
                      ? WIZARD_PROGRESS_DONE
                      : WIZARD_PROGRESS_PENDING
                }`}
              />
            );
          })}
        </ol>
      </div>

      <ol className="hidden w-full min-w-0 gap-0.5 md:flex">
        {ADMIN_BOOKING_WIZARD_STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const active = step === current;
          const fullLabel = ADMIN_BOOKING_WIZARD_STEP_LABELS[step] ?? step;

          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={`min-w-0 flex-1 rounded-lg px-1.5 py-1.5 text-center text-[10px] font-medium leading-tight sm:text-xs ${
                active
                  ? WIZARD_STEPPER_ACTIVE
                  : done
                    ? WIZARD_STEPPER_DONE
                    : WIZARD_STEPPER_PENDING
              }`}
            >
              <span className="block truncate">{fullLabel}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
