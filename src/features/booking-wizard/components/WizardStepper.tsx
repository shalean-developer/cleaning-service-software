import { WIZARD_STEPS, type WizardStep } from "../types";
import { WIZARD_STEP_LABELS } from "../constants";
import { stepIndex } from "../navigation";
import {
  WIZARD_PROGRESS_ACTIVE,
  WIZARD_PROGRESS_DONE,
  WIZARD_PROGRESS_PENDING,
  WIZARD_STEPPER_ACTIVE,
  WIZARD_STEPPER_DONE,
  WIZARD_STEPPER_PENDING,
  WIZARD_TEXT_MUTED,
  WIZARD_TEXT_PRIMARY,
} from "../wizardTheme";

type Props = {
  current: WizardStep;
};

export function WizardStepper({ current }: Props) {
  const currentIdx = stepIndex(current);
  const currentLabel = WIZARD_STEP_LABELS[current] ?? current;
  const stepNumber = currentIdx + 1;
  const totalSteps = WIZARD_STEPS.length;

  return (
    <nav aria-label="Booking progress" className="mb-2.5 md:mb-6">
      <div className="md:hidden">
        <p className={`text-xs font-medium ${WIZARD_TEXT_MUTED}`}>
          Step {stepNumber} of {totalSteps}
        </p>
        <p className={`mt-0.5 text-sm font-semibold ${WIZARD_TEXT_PRIMARY}`} aria-current="step">
          {currentLabel}
        </p>
        <ol className="mt-2 flex gap-1" aria-hidden>
          {WIZARD_STEPS.map((step, idx) => {
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
        {WIZARD_STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const active = step === current;
          const fullLabel = WIZARD_STEP_LABELS[step] ?? step;

          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium ${
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
